/**
 * Integration health-check test suite.
 *
 * Drives a real Puppeteer session through the council booking form
 * (steps 1-5) without ever clicking the final submit, so no booking
 * is created. Acts as a smoke / health check for the live site and
 * the automation selectors.
 *
 * Run: npm run test:health  (from server/ or project root)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BookingDriver } from "../puppeteer/driver.js";
import {
  fillStep1,
  fillStep2,
  fillStep3,
  fillStep4,
  getAvailableDates,
  selectDateAndGetSlots,
} from "../puppeteer/steps.js";
import { loadSettings } from "../config/settings.js";
import { selectors } from "../config/selectors.js";

let driver: BookingDriver;
let dates: Array<{ value: string; label: string }>;
let slots: Array<{ value: string; label: string }>;
let stepFailed = false;

const STEP_TIMEOUT = 120_000; // 2 minutes per step (live site can be slow)

describe("Health check — full booking flow (no confirmation)", () => {
  beforeAll(async () => {
    driver = new BookingDriver();
  }, STEP_TIMEOUT);

  afterAll(async () => {
    if (driver) {
      await driver.close();
    }
  }, 30_000);

  // --- Step 0: launch browser and extract formGuid ---

  it("should reach the council site and extract formGuid", async ({ skip }) => {
    if (stepFailed) return skip();
    try {
      const { formGuid } = await driver.start();

      expect(formGuid).toBeTruthy();
      expect(typeof formGuid).toBe("string");
      expect(formGuid.length).toBeGreaterThan(0);
    } catch (e) {
      stepFailed = true;
      throw e;
    }
  }, STEP_TIMEOUT);

  // --- Step 1: Your details ---

  it("should fill step 1 (Your details) and advance", async ({ skip }) => {
    if (stepFailed) return skip();
    try {
      const settings = loadSettings();
      const sectionBefore = await driver.getCurrentSection();

      await fillStep1(driver, settings);

      const sectionAfter = await driver.getCurrentSection();
      expect(sectionAfter).not.toBe(sectionBefore);
    } catch (e) {
      stepFailed = true;
      throw e;
    }
  }, STEP_TIMEOUT);

  // --- Step 2: Your waste ---

  it("should fill step 2 (Your waste) and advance", async ({ skip }) => {
    if (stepFailed) return skip();
    try {
      const settings = loadSettings();
      const wasteIds =
        settings.wasteDefaults.length > 0
          ? settings.wasteDefaults
          : ["FF34", "FF48", "FF33", "FF50"];

      const sectionBefore = await driver.getCurrentSection();

      await fillStep2(driver, wasteIds);

      const sectionAfter = await driver.getCurrentSection();
      expect(sectionAfter).not.toBe(sectionBefore);
    } catch (e) {
      stepFailed = true;
      throw e;
    }
  }, STEP_TIMEOUT);

  // --- Step 3: Your vehicle ---

  it("should fill step 3 (Your vehicle) and advance", async ({ skip }) => {
    if (stepFailed) return skip();
    try {
      const settings = loadSettings();
      const sectionBefore = await driver.getCurrentSection();

      await fillStep3(driver, settings);

      const sectionAfter = await driver.getCurrentSection();
      expect(sectionAfter).not.toBe(sectionBefore);
    } catch (e) {
      stepFailed = true;
      throw e;
    }
  }, STEP_TIMEOUT);

  // --- Step 4: Terms and conditions ---

  it("should fill step 4 (Terms) and advance", async ({ skip }) => {
    if (stepFailed) return skip();
    try {
      const sectionBefore = await driver.getCurrentSection();

      await fillStep4(driver);

      const sectionAfter = await driver.getCurrentSection();
      expect(sectionAfter).not.toBe(sectionBefore);
    } catch (e) {
      stepFailed = true;
      throw e;
    }
  }, STEP_TIMEOUT);

  // --- Step 5a: Available dates ---

  it("should reach step 5 and find available dates", async ({ skip }) => {
    if (stepFailed) return skip();
    try {
      dates = await getAvailableDates(driver);

      expect(dates.length).toBeGreaterThan(0);
      for (const d of dates) {
        expect(d.value).toBeTruthy();
        expect(d.label).toBeTruthy();
      }
    } catch (e) {
      stepFailed = true;
      throw e;
    }
  }, STEP_TIMEOUT);

  // --- Step 5b: Slots API ---

  it("should fetch time slots for the first available date", async ({ skip }) => {
    if (stepFailed) return skip();
    try {
      const firstDate = dates[0];
      slots = await selectDateAndGetSlots(driver, firstDate.value);

      expect(slots.length).toBeGreaterThan(0);
      for (const s of slots) {
        expect(s.value).toBeTruthy();
        expect(s.label).toBeTruthy();
      }
    } catch (e) {
      stepFailed = true;
      throw e;
    }
  }, STEP_TIMEOUT);

  // --- Step 5c: Select slot and verify submit button (DO NOT click) ---

  it("should select a slot and verify submit button is present (without clicking)", async ({ skip }) => {
    if (stepFailed) return skip();
    try {
      const firstSlot = slots[0];

      await driver.select(selectors.step5.timeSelect, firstSlot.value);

      const page = driver.getPage();

      const submitBtn = await page.$(selectors.form.submitButton);
      expect(submitBtn).not.toBeNull();

      const isVisible = await page.$eval(selectors.form.submitButton, (el) => {
        const style = getComputedStyle(el);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0"
        );
      });
      expect(isVisible).toBe(true);
    } catch (e) {
      stepFailed = true;
      throw e;
    }
  }, STEP_TIMEOUT);
});
