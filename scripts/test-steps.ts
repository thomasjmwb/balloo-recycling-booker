#!/usr/bin/env tsx
/**
 * Step Test Script
 *
 * Tests individual form steps in isolation.
 * Useful for pinpointing automation failures.
 *
 * Usage: npm run test:step -- <step-number>
 */

import puppeteer from "puppeteer";
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const BOOKING_URL = process.env.BOOKING_URL;
if (!BOOKING_URL) {
  console.error("BOOKING_URL not set in .env");
  process.exit(1);
}

const stepArg = process.argv[2];
const targetStep = stepArg ? parseInt(stepArg, 10) : 1;

interface TestResult {
  step: number;
  name: string;
  passed: boolean;
  checks: Array<{ description: string; passed: boolean; error?: string }>;
  duration: number;
}

async function testStep1(page: puppeteer.Page): Promise<TestResult> {
  const start = Date.now();
  const checks: TestResult["checks"] = [];

  // Check email field exists
  try {
    await page.waitForSelector("#FF6", { timeout: 5000 });
    checks.push({ description: "Email field exists", passed: true });
  } catch {
    checks.push({ description: "Email field exists", passed: false, error: "Selector not found" });
  }

  // Check residential/charity dropdown
  try {
    await page.waitForSelector("#FF23", { timeout: 5000 });
    checks.push({ description: "Residential/Charity dropdown exists", passed: true });
  } catch {
    checks.push({ description: "Residential/Charity dropdown exists", passed: false, error: "Selector not found" });
  }

  // Check address postcode input
  try {
    await page.waitForSelector("#FF17-text", { timeout: 5000 });
    checks.push({ description: "Postcode input exists", passed: true });
  } catch {
    checks.push({ description: "Postcode input exists", passed: false, error: "Selector not found" });
  }

  // Check van hire radio buttons
  try {
    await page.waitForSelector("#FF18", { timeout: 5000 });
    await page.waitForSelector("#FF18_No", { timeout: 5000 });
    checks.push({ description: "Van hire radios exist", passed: true });
  } catch {
    checks.push({ description: "Van hire radios exist", passed: false, error: "Selector not found" });
  }

  // Check submit button
  try {
    await page.waitForSelector("#submit-button", { timeout: 5000 });
    checks.push({ description: "Submit button exists", passed: true });
  } catch {
    checks.push({ description: "Submit button exists", passed: false, error: "Selector not found" });
  }

  return {
    step: 1,
    name: "Your details",
    passed: checks.every((c) => c.passed),
    checks,
    duration: Date.now() - start,
  };
}

async function testStep2(page: puppeteer.Page): Promise<TestResult> {
  const start = Date.now();
  const checks: TestResult["checks"] = [];

  // Check waste checkboxes exist
  const wasteIds = ["FF34", "FF48", "FF33", "FF50", "FF32", "FF26", "FF28"];
  for (const id of wasteIds) {
    try {
      await page.waitForSelector(`#${id}`, { timeout: 2000 });
      checks.push({ description: `Waste checkbox ${id} exists`, passed: true });
    } catch {
      checks.push({ description: `Waste checkbox ${id} exists`, passed: false, error: "Selector not found" });
    }
  }

  return {
    step: 2,
    name: "Your waste",
    passed: checks.every((c) => c.passed),
    checks,
    duration: Date.now() - start,
  };
}

async function testStep3(page: puppeteer.Page): Promise<TestResult> {
  const start = Date.now();
  const checks: TestResult["checks"] = [];

  const selectors = ["#FF7", "#FF19", "#FF77", "#FF22"];
  const names = ["Vehicle registration", "Transport type", "Trailer type", "Site"];

  for (let i = 0; i < selectors.length; i++) {
    try {
      await page.waitForSelector(selectors[i], { timeout: 2000 });
      checks.push({ description: `${names[i]} field exists`, passed: true });
    } catch {
      checks.push({ description: `${names[i]} field exists`, passed: false, error: "Selector not found" });
    }
  }

  return {
    step: 3,
    name: "Your vehicle",
    passed: checks.every((c) => c.passed),
    checks,
    duration: Date.now() - start,
  };
}

async function testStep4(page: puppeteer.Page): Promise<TestResult> {
  const start = Date.now();
  const checks: TestResult["checks"] = [];

  try {
    await page.waitForSelector("#FF3", { timeout: 5000 });
    checks.push({ description: "Terms checkbox exists", passed: true });
  } catch {
    checks.push({ description: "Terms checkbox exists", passed: false, error: "Selector not found" });
  }

  return {
    step: 4,
    name: "Terms and conditions",
    passed: checks.every((c) => c.passed),
    checks,
    duration: Date.now() - start,
  };
}

async function testStep5(page: puppeteer.Page): Promise<TestResult> {
  const start = Date.now();
  const checks: TestResult["checks"] = [];

  try {
    await page.waitForSelector("#FF8_Date", { timeout: 5000 });
    checks.push({ description: "Date dropdown exists", passed: true });
  } catch {
    checks.push({ description: "Date dropdown exists", passed: false, error: "Selector not found" });
  }

  try {
    await page.waitForSelector("#FF8_Time", { timeout: 5000 });
    checks.push({ description: "Time dropdown exists", passed: true });
  } catch {
    checks.push({ description: "Time dropdown exists", passed: false, error: "Selector not found" });
  }

  return {
    step: 5,
    name: "Your booking",
    passed: checks.every((c) => c.passed),
    checks,
    duration: Date.now() - start,
  };
}

async function main() {
  console.log(`Testing step ${targetStep}...`);
  console.log("URL:", BOOKING_URL);

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto(BOOKING_URL, { waitUntil: "networkidle2" });

    let result: TestResult;

    // Note: To test later steps, you'd need to fill earlier steps first
    // This simplified version only tests step 1 properly
    switch (targetStep) {
      case 1:
        result = await testStep1(page);
        break;
      case 2:
        result = await testStep2(page);
        break;
      case 3:
        result = await testStep3(page);
        break;
      case 4:
        result = await testStep4(page);
        break;
      case 5:
        result = await testStep5(page);
        break;
      default:
        console.error("Invalid step number. Use 1-5.");
        process.exit(1);
    }

    console.log("\n--- Results ---");
    console.log(`Step ${result.step}: ${result.name}`);
    console.log(`Status: ${result.passed ? "PASSED ✓" : "FAILED ✗"}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log("\nChecks:");
    result.checks.forEach((check) => {
      const icon = check.passed ? "✓" : "✗";
      console.log(`  ${icon} ${check.description}${check.error ? ` (${check.error})` : ""}`);
    });

    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error("Test error:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
