import puppeteer, { Browser, Page, Cookie } from "puppeteer";
import { BOOKING_URL, HEADLESS } from "../config/env.js";
import { selectors } from "../config/selectors.js";

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

    // Extract formGuid
    const guid = await this.page.$eval(selectors.form.formGuid, (el) => {
      return (el as unknown as { value: string }).value;
    });

    if (!guid) {
      throw new Error("Could not extract formGuid from page");
    }

    this.formGuid = guid;
    console.log("[Driver] FormGuid:", this.formGuid);
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
   * Clicks submit button and waits for page load.
   */
  async submitAndWait(): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: "networkidle2" }),
      this.page.click(selectors.form.submitButton),
    ]);
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
   * Selects an option from a dropdown by value.
   */
  async select(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error("Driver not started");
    await this.page.waitForSelector(selector, { visible: true });
    await this.page.select(selector, value);
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
