/**
 * Balloo Recycling Booker
 *
 * Headless browser automation for booking recycling appointments.
 * Uses Puppeteer to interact with the ASPX booking form.
 */

import puppeteer, { type Browser } from "puppeteer";
import { BOOKING_URL, getFormParams, HEADLESS } from "./config/env.js";

async function main(): Promise<void> {
  console.log("Starting recycling booker...");
  console.log("URL:", BOOKING_URL);
  console.log("Form params:", getFormParams());
  console.log("Headless:", HEADLESS);

  let browser: Browser | undefined;

  try {
    browser = await puppeteer.launch({
      headless: HEADLESS,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to booking URL
    await page.goto(BOOKING_URL, { waitUntil: "networkidle2" });

    // TODO: Implement form filling and submission
    // const formParams = getFormParams();
    // for (const [name, value] of Object.entries(formParams)) {
    //   await page.type(`[name="${name}"]`, value);
    // }

    console.log("Page loaded. Form interaction not yet implemented.");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await browser?.close();
  }
}

main();
