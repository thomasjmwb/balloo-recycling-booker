#!/usr/bin/env tsx
/**
 * Slots Request Capture
 *
 * Launches a browser, navigates to the booking form, and captures the
 * getavailabletimeslots request when you manually select a date.
 * Use this to capture the "correct" request format from a working manual session.
 *
 * Usage: npm run discover  (or add script: "debug:slots": "cd scripts && tsx debug-slots-capture.ts")
 *
 * Steps:
 * 1. Fill the form manually through to step 5 (date selection)
 * 2. Select a date - the script captures the request
 * 3. Output is saved to data/logs/slots-capture-manual.json
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

async function main() {
  console.log("Slots capture - open browser and manually go to step 5.");
  console.log("When you select a date, the getavailabletimeslots request will be captured.\n");

  const logsDir = join(__dirname, "../data/logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });

  const captured: {
    request?: { url: string; method: string; postData?: string; headers: Record<string, string> };
    response?: { status: number; bodyPreview: string };
  } = {};

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on("request", (req) => {
    if (req.url().includes("getavailabletimeslots")) {
      captured.request = {
        url: req.url(),
        method: req.method(),
        postData: req.postData(),
        headers: req.headers(),
      };
      console.log("[Capture] Request captured");
    }
  });

  page.on("response", async (res) => {
    if (res.url().includes("getavailabletimeslots")) {
      try {
        const text = await res.text();
        captured.response = { status: res.status(), bodyPreview: text.slice(0, 800) };
        console.log("[Capture] Response captured, status:", res.status());

        const outPath = join(logsDir, "slots-capture-manual.json");
        writeFileSync(
          outPath,
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              request: captured.request,
              response: captured.response,
              curlTemplate: captured.request
                ? `curl -X POST "${captured.request.url}" \\
  -H "content-type: application/x-www-form-urlencoded" \\
  -H "cookie: <YOUR_COOKIE>" \\
  -H "referer: ${captured.request.headers["referer"] || ""}" \\
  --data-raw "${captured.request.postData || ""}"`
                : null,
            },
            null,
            2
          ),
          "utf-8"
        );
        console.log("[Capture] Saved to", outPath);
      } catch (e) {
        console.error("[Capture] Could not read response:", e);
      }
    }
  });

  await page.goto(BOOKING_URL, { waitUntil: "networkidle2" });
  console.log("Browser open. Fill the form to step 5, then select a date.");
  console.log("Press Ctrl+C when done.\n");

  await new Promise(() => {});
}

main().catch(console.error);
