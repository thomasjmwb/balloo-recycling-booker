import { BookingDriver } from "./driver.js";
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

  // Email
  await driver.type(selectors.step1.email, settings.email);

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

  // Address lookup
  if (settings.postcode) {
    await driver.type(selectors.step1.postcodeInput, settings.postcode);
    await driver.click(selectors.step1.postcodeSearchBtn);

    // Wait for address list to populate
    await page.waitForFunction(
      (sel) => {
        const select = document.querySelector(sel) as HTMLSelectElement | null;
        return select && select.options.length > 1;
      },
      { timeout: 10000 },
      selectors.step1.addressList
    );

    // Select address by value or first available
    if (settings.addressValue) {
      await driver.select(selectors.step1.addressList, settings.addressValue);
    } else {
      // Select first real address (skip placeholder)
      const options = await driver.getSelectOptions(selectors.step1.addressList);
      const firstReal = options.find((o) => o.value && o.value !== "0" && !o.value.startsWith("{"));
      if (firstReal) {
        await driver.select(selectors.step1.addressList, firstReal.value);
      }
    }
  }

  // Van hire
  if (settings.hiringVan) {
    await driver.clickRadio(selectors.step1.hiringVanYes);
  } else {
    await driver.clickRadio(selectors.step1.hiringVanNo);
  }

  console.log("[Step1] Submitting...");
  await driver.submitAndWait();
}

/**
 * Fills Step 2: Your waste (checkboxes)
 * Returns the waste types so PWA can display them.
 */
export async function fillStep2(
  driver: BookingDriver,
  selectedWasteIds: string[]
): Promise<void> {
  console.log("[Step2] Filling Your waste...");

  // Uncheck all first
  for (const waste of wasteTypes) {
    const selector = `#${waste.id}`;
    await driver.setCheckbox(selector, false);
  }

  // Check selected
  for (const id of selectedWasteIds) {
    const selector = `#${id}`;
    if (await driver.exists(selector)) {
      await driver.setCheckbox(selector, true);
    }
  }

  console.log("[Step2] Submitting...");
  await driver.submitAndWait();
}

/**
 * Fills Step 3: Your vehicle
 */
export async function fillStep3(driver: BookingDriver, settings: Settings): Promise<void> {
  console.log("[Step3] Filling Your vehicle...");

  // Vehicle registration
  await driver.type(selectors.step3.vehicleRegistration, settings.vehicleRegistration);

  // Transport type
  await driver.select(selectors.step3.transportType, settings.transportType);

  // Trailer type
  await driver.select(selectors.step3.trailerType, settings.trailerType);

  // Site
  await driver.select(selectors.step3.site, settings.site);

  console.log("[Step3] Submitting...");
  await driver.submitAndWait();
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
  console.log("[Step5] Getting available dates...");
  const options = await driver.getSelectOptions(selectors.step5.dateSelect);
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
  console.log("[Step5] Selecting date:", dateValue);
  await driver.select(selectors.step5.dateSelect, dateValue);

  // Wait for time slots to load
  const page = driver.getPage();
  await page.waitForFunction(
    (sel) => {
      const select = document.querySelector(sel) as HTMLSelectElement | null;
      return select && select.options.length > 1;
    },
    { timeout: 10000 },
    selectors.step5.timeSelect
  );

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
  console.log("[Step5] Selecting time slot:", slotValue);
  await driver.select(selectors.step5.timeSelect, slotValue);

  console.log("[Step5] Final submit...");
  await driver.submitAndWait();
}
