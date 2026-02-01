#!/usr/bin/env tsx
/**
 * Discovery Script
 *
 * Inspects the ASPX form and outputs structured metadata.
 * Useful for mapping selectors, understanding form structure,
 * and detecting changes.
 *
 * Usage: npm run discover
 */

import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync, existsSync } from "fs";
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

interface FieldInfo {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  visible: boolean;
}

interface StepInfo {
  index: number;
  title: string;
  fields: FieldInfo[];
  buttons: string[];
  screenshot?: string;
}

interface DiscoveryReport {
  url: string;
  timestamp: string;
  formGuid: string;
  hiddenInputs: Record<string, string>;
  steps: StepInfo[];
}

async function discoverStep(page: puppeteer.Page, stepIndex: number): Promise<StepInfo> {
  // Get step title
  const title = await page.evaluate(() => {
    const h2 = document.querySelector(".esbRenderForm h2");
    return h2?.textContent?.trim() || "Unknown";
  });

  // Get all form fields
  const fields = await page.evaluate(() => {
    const result: FieldInfo[] = [];

    // Inputs
    document.querySelectorAll("input").forEach((input) => {
      if (input.type === "hidden") return;
      const parent = input.closest(".mb-3");
      result.push({
        id: input.id,
        name: input.name,
        type: input.type,
        required: input.required,
        visible: parent ? getComputedStyle(parent).display !== "none" : true,
      });
    });

    // Selects
    document.querySelectorAll("select").forEach((select) => {
      const parent = select.closest(".mb-3");
      const options = Array.from(select.options).map((opt) => ({
        value: opt.value,
        label: opt.textContent?.trim() || "",
      }));
      result.push({
        id: select.id,
        name: select.name,
        type: "select",
        required: select.required,
        options,
        visible: parent ? getComputedStyle(parent).display !== "none" : true,
      });
    });

    return result;
  });

  // Get buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button")).map((btn) => btn.id || btn.textContent?.trim() || "");
  });

  // Take screenshot
  const screenshotPath = `data/discovery/step${stepIndex}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });

  return {
    index: stepIndex,
    title,
    fields,
    buttons,
    screenshot: screenshotPath,
  };
}

async function main() {
  console.log("Starting discovery...");
  console.log("URL:", BOOKING_URL);

  // Ensure data directory exists
  if (!existsSync("data/discovery")) {
    mkdirSync("data/discovery", { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Enable request interception to log XHR
  await page.setRequestInterception(true);
  const xhrCalls: Array<{ url: string; method: string; body?: string }> = [];

  page.on("request", (request) => {
    if (request.resourceType() === "xhr" || request.resourceType() === "fetch") {
      xhrCalls.push({
        url: request.url(),
        method: request.method(),
        body: request.postData(),
      });
    }
    request.continue();
  });

  try {
    await page.goto(BOOKING_URL, { waitUntil: "networkidle2" });

    // Get hidden inputs
    const hiddenInputs = await page.evaluate(() => {
      const result: Record<string, string> = {};
      document.querySelectorAll('input[type="hidden"]').forEach((input) => {
        const el = input as HTMLInputElement;
        if (el.name) result[el.name] = el.value;
      });
      return result;
    });

    const formGuid = hiddenInputs["FormGuid"] || "";
    console.log("FormGuid:", formGuid);

    const report: DiscoveryReport = {
      url: BOOKING_URL,
      timestamp: new Date().toISOString(),
      formGuid,
      hiddenInputs,
      steps: [],
    };

    // Discover each step
    let stepIndex = 1;
    const maxSteps = 6;

    while (stepIndex <= maxSteps) {
      console.log(`\nDiscovering step ${stepIndex}...`);

      const stepInfo = await discoverStep(page, stepIndex);
      report.steps.push(stepInfo);

      console.log(`  Title: ${stepInfo.title}`);
      console.log(`  Fields: ${stepInfo.fields.length}`);
      console.log(`  Visible fields: ${stepInfo.fields.filter((f) => f.visible).length}`);

      // Check if we should advance
      const hasSubmit = await page.$("#submit-button");
      if (!hasSubmit) {
        console.log("No submit button found, stopping.");
        break;
      }

      // Wait for user to inspect
      console.log("Press Enter to advance to next step (or Ctrl+C to stop)...");
      await new Promise<void>((resolve) => {
        process.stdin.once("data", () => resolve());
      });

      // Try to click submit (this may fail if fields aren't filled)
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 5000 }),
          page.click("#submit-button"),
        ]);
        stepIndex++;
      } catch {
        console.log("Could not advance (validation error or timeout). Stopping discovery.");
        break;
      }
    }

    // Log XHR calls
    console.log("\nXHR/Fetch calls observed:");
    xhrCalls.forEach((call) => {
      console.log(`  ${call.method} ${call.url}`);
      if (call.body) console.log(`    Body: ${call.body.substring(0, 100)}...`);
    });

    // Save report
    const reportPath = "data/discovery/report.json";
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to ${reportPath}`);

    // Keep browser open for manual inspection
    console.log("\nBrowser left open for inspection. Press Ctrl+C to exit.");
    await new Promise(() => {}); // Wait forever
  } catch (error) {
    console.error("Discovery error:", error);
  } finally {
    await browser.close();
  }
}

main();
