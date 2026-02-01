import { BookingDriver } from "./driver.js";
import { logScreenshot } from "./htmlLogger.js";
import { selectors, wasteTypes } from "../config/selectors.js";
import type { Settings } from "../config/settings.js";

/** Helper to delay execution */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fills Step 1: Your details
 */
export async function fillStep1(driver: BookingDriver, settings: Settings): Promise<void> {
  const page = driver.getPage();
  console.log("[Step1] Filling Your details...");

  // Email (use fill to clear any placeholder)
  await driver.fill(selectors.step1.email, settings.email);

  // Blue badge holder
  if (settings.blueBadgeHolder) {
    await driver.setCheckbox(selectors.step1.blueBadgeHolder, true);
  }

  // Residential or Charity
  await driver.select(selectors.step1.residentialOrCharity, settings.residentialOrCharity);

  // Wait for conditional fields to appear
  await delay(500);

  // Who brings waste (for residential)
  if (settings.residentialOrCharity === "Residential" && settings.whoBringsWaste) {
    await driver.select(selectors.step1.whoBringsWaste, settings.whoBringsWaste);
  }

  // Charity fields
  if (settings.residentialOrCharity === "Charity") {
    if (settings.charityId) {
      await driver.select(selectors.step1.charityName, settings.charityId);
    }
    if (settings.charityNumber) {
      await driver.type(selectors.step1.charityNumber, settings.charityNumber);
    }
  }

  // Address lookup: postcode → click Search → wait for addresses → select
  if (settings.postcode) {
    const postcode = settings.postcode.trim();
    console.log("[Step1] Entering postcode:", JSON.stringify(postcode));

    // 1. Find postcode input
    const postcodeInputFound = await driver.exists(selectors.step1.postcodeInput);
    if (!postcodeInputFound) {
      throw new Error(
        `[Address lookup] Postcode input not found. Selector: ${selectors.step1.postcodeInput}. ` +
          "Check if the form structure changed."
      );
    }
    console.log("[Step1] Postcode input found:", selectors.step1.postcodeInput);
    await logScreenshot(page, "address-1-input-found");

    // 2. Fill postcode programmatically (set value + dispatch input/change events)
    await driver.fill(selectors.step1.postcodeInput, postcode);

    // Wait until postcode is visible in the input (in case form overwrites it)
    const postcodeMin = postcode.replace(/\s/g, "").slice(0, 4).toUpperCase();
    try {
      await page.waitForFunction(
        (sel, expected) => {
          const input = document.querySelector(sel) as HTMLInputElement | null;
          if (!input) return false;
          const val = (input.value || "").replace(/\s/g, "").toUpperCase();
          return val.length >= 5 && val.includes(expected);
        },
        { timeout: 5000 },
        selectors.step1.postcodeInput,
        postcodeMin
      );
    } catch (waitErr) {
      const actualValue = await page.$eval(selectors.step1.postcodeInput, (el) => (el as HTMLInputElement).value);
      throw new Error(
        `[Address lookup] Postcode did not appear in input within 5s. Expected to contain "${postcodeMin}", got: "${actualValue}". ` +
          `The input may not accept programmatic input. Original: ${(waitErr as Error).message}`
      );
    }
    const typedValue = await page.$eval(selectors.step1.postcodeInput, (el) => (el as HTMLInputElement).value);
    console.log("[Step1] Postcode visible in input, value:", JSON.stringify(typedValue));
    await logScreenshot(page, "address-2-after-fill");

    // 3. Click Search button
    const searchBtnFound = await driver.exists(selectors.step1.postcodeSearchBtn);
    if (!searchBtnFound) {
      throw new Error(
        `[Address lookup] Search button not found. Selector: ${selectors.step1.postcodeSearchBtn}`
      );
    }
    await driver.click(selectors.step1.postcodeSearchBtn);
    console.log("[Step1] Search button clicked");
    await logScreenshot(page, "address-3-after-search");

    // 4. Wait for address dropdown to appear and populate
    try {
      await page.waitForFunction(
        (sel) => {
          const select = document.querySelector(sel) as HTMLSelectElement | null;
          if (!select) return false;
          for (let i = 0; i < select.options.length; i++) {
            const opt = select.options[i];
            if (opt.value && opt.value.includes("|")) return true; // Real address: "25134|52 BLOOMFIELD ROAD..."
          }
          return false;
        },
        { timeout: 15000 },
        selectors.step1.addressList
      );
    } catch (waitErr) {
      // Gather debug info
      const debugInfo = await page.evaluate((sel) => {
        const input = document.querySelector("#FF17-text") as HTMLInputElement | null;
        const addressDiv = document.querySelector("#FF17dvs") as HTMLElement | null;
        const select = document.querySelector(sel) as HTMLSelectElement | null;
        return {
          postcodeInputValue: input?.value ?? "not found",
          postcodeInputVisible: input ? getComputedStyle(input).display !== "none" : false,
          addressDivDisplay: addressDiv ? getComputedStyle(addressDiv).display : "not found",
          addressDivVisible: addressDiv ? getComputedStyle(addressDiv).display !== "none" : false,
          selectOptionsCount: select?.options?.length ?? 0,
          selectOptionValues: select ? Array.from(select.options).slice(0, 5).map((o) => o.value) : [],
        };
      }, selectors.step1.addressList);

      throw new Error(
        `[Address lookup] Address dropdown did not populate within 15s. ` +
          `Debug: postcodeInputValue="${debugInfo.postcodeInputValue}", ` +
          `addressDivDisplay="${debugInfo.addressDivDisplay}", ` +
          `selectOptionsCount=${debugInfo.selectOptionsCount}, ` +
          `selectOptionValues=${JSON.stringify(debugInfo.selectOptionValues)}. ` +
          `Original error: ${(waitErr as Error).message}`
      );
    }
    console.log("[Step1] Address dropdown populated");
    await logScreenshot(page, "address-4-dropdown");

    // 5a. Wait for address container #FF17dvs to be visible (loading may hide it)
    await page.waitForFunction(
      () => {
        const div = document.querySelector("#FF17dvs") as HTMLElement | null;
        return div && getComputedStyle(div).display !== "none";
      },
      { timeout: 5000 }
    );
    console.log("[Step1] Address container visible");
    await delay(500);
    await logScreenshot(page, "address-5a-container-visible");

    // 5b. Wait for select to be visible and enabled (no loading overlay)
    await page.waitForSelector(selectors.step1.addressList, {
      visible: true,
      timeout: 5000,
    });
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel) as HTMLSelectElement | null;
        return el && !el.disabled;
      },
      { timeout: 3000 },
      selectors.step1.addressList
    );
    await delay(300);
    await logScreenshot(page, "address-5b-select-ready");

    // 5c. Scroll select into view
    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      el?.scrollIntoView({ block: "center" });
    }, selectors.step1.addressList);
    await delay(500);
    await logScreenshot(page, "address-5c-after-scroll");

    let addressToSelect: string;
    if (settings.addressValue) {
      addressToSelect = settings.addressValue;
    } else {
      const options = await driver.getSelectOptions(selectors.step1.addressList);
      const firstReal = options.find((o) => o.value && o.value.includes("|"));
      if (!firstReal) {
        throw new Error("[Address lookup] No address options with valid format found to select.");
      }
      addressToSelect = firstReal.value;
    }

    // 5d. Click and use keyboard to open the native select dropdown
    await driver.click(selectors.step1.addressList);
    await delay(200);
    await page.keyboard.press("Space");
    await delay(300);
    await logScreenshot(page, "address-5d-after-click-space");

    // 5e. ArrowDown x2 to skip placeholder and select first real address, then Enter
    await page.keyboard.press("ArrowDown");
    await delay(100);
    await page.keyboard.press("ArrowDown");
    await delay(100);
    await page.keyboard.press("Enter");
    await delay(300);
    await logScreenshot(page, "address-5e-after-select");
    console.log("[Step1] Selected address value:", addressToSelect);

    // 6. Verify hidden #FF17 was populated; if not, set it manually (format: "id|address" -> id goes in #FF17)
    await delay(300);
    let ff17Value = await page.$eval(selectors.step1.addressHidden, (el) => (el as HTMLInputElement).value);
    if (!ff17Value) {
      const selectedValue = await page.$eval(
        selectors.step1.addressList,
        (el) => (el as HTMLSelectElement).value
      );
      if (selectedValue && selectedValue.includes("|")) {
        const addressId = selectedValue.split("|")[0];
        await page.$eval(
          selectors.step1.addressHidden,
          (el, id) => {
            const input = el as HTMLInputElement;
            input.value = id;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          },
          addressId
        );
        ff17Value = addressId;
        console.log("[Step1] Manually set #FF17 to:", ff17Value);
      } else {
        throw new Error(
          `[Address lookup] Hidden #FF17 was not populated and could not be set. ` +
            `Selected value: "${selectedValue}".`
        );
      }
    }
    console.log("[Step1] Address confirmed, #FF17 value:", ff17Value);
    await logScreenshot(page, "address-5-selected");
  } else {
    throw new Error("Postcode is required but not set in settings. Configure it in .env (POSTCODE) or the Settings page.");
  }

  // Van hire
  if (settings.hiringVan) {
    await driver.clickRadio(selectors.step1.hiringVanYes);
  } else {
    await driver.clickRadio(selectors.step1.hiringVanNo);
  }

  console.log("[Step1] Submitting...");
  await driver.submitAndWait();
  await logScreenshot(page, "step1-2-after-submit");
}

/**
 * Fills Step 2: Your waste (checkboxes)
 * Returns the waste types so PWA can display them.
 */
export async function fillStep2(
  driver: BookingDriver,
  selectedWasteIds: string[]
): Promise<void> {
  const page = driver.getPage();
  console.log("[Step2] Filling Your waste...");
  await logScreenshot(page, "step2-1-form");

  // Uncheck all first (skip checkboxes that don't exist on this page)
  for (const waste of wasteTypes) {
    const selector = `#${waste.id}`;
    if (await driver.exists(selector)) {
      await driver.setCheckbox(selector, false);
    }
  }

  // Check selected
  for (const id of selectedWasteIds) {
    const selector = `#${id}`;
    if (await driver.exists(selector)) {
      await driver.setCheckbox(selector, true);
    }
  }

  await logScreenshot(page, "step2-2-after-checkboxes");
  console.log("[Step2] Submitting...");
  await driver.submitAndWait();
  await logScreenshot(page, "step2-3-after-submit");
}

/**
 * Fills Step 3: Your vehicle
 */
export async function fillStep3(driver: BookingDriver, settings: Settings): Promise<void> {
  const page = driver.getPage();
  console.log("[Step3] Filling Your vehicle...");
  await logScreenshot(page, "step3-1-form");

  // Vehicle registration
  await driver.type(selectors.step3.vehicleRegistration, settings.vehicleRegistration);

  // Transport type
  await driver.select(selectors.step3.transportType, settings.transportType);

  // Trailer type
  await driver.select(selectors.step3.trailerType, settings.trailerType);

  // Site
  await driver.select(selectors.step3.site, settings.site);

  await logScreenshot(page, "step3-2-after-fill");
  console.log("[Step3] Submitting...");
  await driver.submitAndWait();
  await logScreenshot(page, "step3-3-after-submit");
}

/**
 * Fills Step 4: Terms and conditions (just checks the box)
 */
export async function fillStep4(driver: BookingDriver): Promise<void> {
  console.log("[Step4] Accepting terms...");
  await driver.setCheckbox(selectors.step4.termsCheckbox, true);

  console.log("[Step4] Submitting...");
  await driver.submitAndWait();
}

/**
 * Extracts available dates from Step 5.
 */
export async function getAvailableDates(
  driver: BookingDriver
): Promise<Array<{ value: string; label: string }>> {
  const page = driver.getPage();
  console.log("[Step5] Getting available dates...");
  await logScreenshot(page, "step5-1-dates-form");

  const options = await driver.getSelectOptions(selectors.step5.dateSelect);
  await logScreenshot(page, "step5-2-dates-ready");
  // Filter out placeholder
  return options.filter((o) => o.value && !o.value.startsWith("{"));
}

/**
 * Selects a date and gets available time slots.
 */
export async function selectDateAndGetSlots(
  driver: BookingDriver,
  dateValue: string
): Promise<Array<{ value: string; label: string }>> {
  const page = driver.getPage();
  console.log("[Step5] Selecting date:", dateValue);
  await driver.select(selectors.step5.dateSelect, dateValue);
  await logScreenshot(page, "step5-3-after-date-select");

  // Wait for time slots to load
  await page.waitForFunction(
    (sel) => {
      const select = document.querySelector(sel) as HTMLSelectElement | null;
      return select && select.options.length > 1;
    },
    { timeout: 10000 },
    selectors.step5.timeSelect
  );

  await logScreenshot(page, "step5-4-slots-loaded");
  const options = await driver.getSelectOptions(selectors.step5.timeSelect);
  return options.filter((o) => o.value && !o.value.startsWith("{"));
}

/**
 * Selects a time slot and submits the final form.
 */
export async function selectSlotAndSubmit(
  driver: BookingDriver,
  slotValue: string
): Promise<void> {
  const page = driver.getPage();
  console.log("[Step5] Selecting time slot:", slotValue);
  await driver.select(selectors.step5.timeSelect, slotValue);
  await logScreenshot(page, "step5-5-after-slot-select");

  console.log("[Step5] Final submit...");
  await driver.submitAndWait();
  await logScreenshot(page, "step5-6-confirmation");
}
