import puppeteer, { Browser, Page, Cookie } from "puppeteer";
import { BOOKING_URL, HEADLESS } from "../config/env.js";
import { selectors } from "../config/selectors.js";
import { logHtmlSnapshot, logScreenshot } from "./htmlLogger.js";

/**
 * Manages a Puppeteer browser session for form automation.
 */
export class BookingDriver {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private formGuid: string | null = null;

  /**
   * Launches browser and navigates to booking form.
   */
  async start(): Promise<{ formGuid: string }> {
    console.log("[Driver] Launching browser...");
    this.browser = await puppeteer.launch({
      headless: HEADLESS,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });

    console.log("[Driver] Navigating to:", BOOKING_URL);
    await this.page.goto(BOOKING_URL, { waitUntil: "networkidle2" });

    // Extract formGuid with fallback selector
    let guid: string | null = null;
    let usedSelector = "";

    try {
      // Try primary selector first
      console.log("[Driver] Looking for formGuid with primary selector:", selectors.form.formGuid);
      await this.page.waitForSelector(selectors.form.formGuid, { timeout: 15000 });
      guid = await this.page.$eval(selectors.form.formGuid, (el) => {
        return (el as unknown as { value: string }).value;
      });
      usedSelector = selectors.form.formGuid;
      console.log("[Driver] Found formGuid using primary selector");
    } catch (primaryError) {
      console.log("[Driver] Primary selector failed, trying fallback:", selectors.form.formGuidFallback);
      try {
        // Try fallback selector
        await this.page.waitForSelector(selectors.form.formGuidFallback, { timeout: 5000 });
        guid = await this.page.$eval(selectors.form.formGuidFallback, (el) => {
          return (el as unknown as { value: string }).value;
        });
        usedSelector = selectors.form.formGuidFallback;
        console.log("[Driver] Found formGuid using fallback selector");
      } catch (fallbackError) {
        // Both selectors failed - log HTML and screenshot, then throw
        const logPath = await logHtmlSnapshot(
          this.page,
          "error-form-guid",
          "Failed to find formGuid with both primary and fallback selectors"
        );
        const screenshotPath = await logScreenshot(this.page, "error-form-guid");
        console.error("[Driver] FormGuid not found. HTML snapshot:", logPath, "Screenshot:", screenshotPath);
        throw new Error(
          `FormGuid input not found. Tried selectors: ${selectors.form.formGuid} and ${selectors.form.formGuidFallback}. ` +
            `Check if the page shows a "Start" button first, or if the page structure changed. ` +
            `HTML snapshot: ${logPath}, Screenshot: ${screenshotPath}`
        );
      }
    }

    if (!guid) {
      const logPath = await logHtmlSnapshot(
        this.page,
        "error-form-guid-empty",
        "FormGuid input found but value is empty"
      );
      throw new Error(`FormGuid value is empty. HTML snapshot: ${logPath}`);
    }

    this.formGuid = guid;
    console.log("[Driver] FormGuid:", this.formGuid, `(using ${usedSelector})`);
    return { formGuid: this.formGuid };
  }

  /**
   * Gets current page.
   */
  getPage(): Page {
    if (!this.page) throw new Error("Driver not started");
    return this.page;
  }

  /**
   * Gets formGuid.
   */
  getFormGuid(): string {
    if (!this.formGuid) throw new Error("FormGuid not available");
    return this.formGuid;
  }

  /**
   * Gets cookies from the browser session.
   */
  async getCookies(): Promise<Cookie[]> {
    if (!this.page) throw new Error("Driver not started");
    return this.page.cookies();
  }

  /**
   * Gets current section ID from hidden input.
   */
  async getCurrentSection(): Promise<number> {
    if (!this.page) throw new Error("Driver not started");
    const val = await this.page.$eval(selectors.form.currentSectionId, (el) => {
      return (el as unknown as { value: string }).value;
    });
    return parseInt(val, 10);
  }

  /**
   * Waits for navigation after form submission.
   */
  async waitForNavigation(timeout = 30000): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.waitForNavigation({ waitUntil: "networkidle2", timeout });
  }

  /**
   * Clicks submit button and waits for form update.
   * This form uses AJAX - it POSTs to /renderform/Form and replaces #body-content.
   */
  async submitAndWait(): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    const currentSection = await this.getCurrentSection();
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().toLowerCase().includes("/renderform/form") && res.request().method() === "POST",
      { timeout: 15000 }
    );
    await this.page.click(selectors.form.submitButton);
    await responsePromise;
    // Wait for DOM to update
    await new Promise((r) => setTimeout(r, 500));
    // Check we advanced - if still on same section, validation may have failed
    const newSection = await this.getCurrentSection();
    if (newSection === currentSection) {
      const hasError = await this.page.$(".validation-summary-errors, .alert-danger");
      if (hasError) {
        const errorText = await this.page.$eval(
          ".validation-summary-errors, .alert-danger",
          (el) => (el as HTMLElement).textContent || ""
        );
        throw new Error(`Form validation failed (still on section ${currentSection}): ${errorText}`);
      }
    }
  }

  /**
   * Takes a screenshot.
   */
  async screenshot(path: string): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.screenshot({ path, fullPage: true });
  }

  /**
   * Closes the browser.
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.formGuid = null;
    }
  }

  /**
   * Types text into an input field.
   */
  async type(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.waitForSelector(selector, { visible: true });
    await this.page.type(selector, text);
  }

  /**
   * Clears an input field and types text. Use for fields that may have placeholder or previous value.
   */
  async fill(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.waitForSelector(selector, { visible: true });
    await this.page.$eval(
      selector,
      (el, value) => {
        const input = el as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      text
    );
  }

  /**
   * Selects an option from a dropdown by value.
   * Dispatches change event so form handlers (e.g. onAddressLookupListChange) run.
   */
  async select(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.waitForSelector(selector, { visible: true });
    await this.page.select(selector, value);
    // Form handlers like onAddressLookupListChange rely on change event - ensure it fires
    await this.page.$eval(selector, (el) => {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  /**
   * Clicks an element.
   */
  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.waitForSelector(selector, { visible: true });
    await this.page.click(selector);
  }

  /**
   * Checks or unchecks a checkbox.
   */
  async setCheckbox(selector: string, checked: boolean): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.waitForSelector(selector);
    const isChecked = await this.page.$eval(selector, (el) => {
      return (el as unknown as { checked: boolean }).checked;
    });
    if (isChecked !== checked) {
      await this.page.click(selector);
    }
  }

  /**
   * Clicks a radio button.
   */
  async clickRadio(selector: string): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.waitForSelector(selector);
    await this.page.click(selector);
  }

  /**
   * Gets options from a select element.
   */
  async getSelectOptions(selector: string): Promise<Array<{ value: string; label: string }>> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.waitForSelector(selector);
    return this.page.$$eval(selector + " option", (options) =>
      options.map((opt) => ({
        value: (opt as unknown as { value: string }).value,
        label: opt.textContent?.trim() || "",
      }))
    );
  }

  /**
   * Waits for an element to appear.
   */
  async waitFor(selector: string, timeout = 10000): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.waitForSelector(selector, { visible: true, timeout });
  }

  /**
   * Checks if an element exists.
   */
  async exists(selector: string): Promise<boolean> {
    if (!this.page) throw new Error("Driver not started");
    const el = await this.page.$(selector);
    return el !== null;
  }
}
