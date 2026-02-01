import { Page } from "puppeteer";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, "../../../data/logs");

/**
 * Writes HTML snapshot to a log file for debugging.
 * Overwrites the same file on each call to avoid filling disk.
 *
 * @param page - Puppeteer page
 * @param label - Short label for the log file (e.g. "error-form-guid", "step1-failure")
 * @param errorMessage - Optional error message to include in the log
 * @returns Path to the written log file
 */
export async function logHtmlSnapshot(
  page: Page,
  label: string,
  errorMessage?: string
): Promise<string> {
  // Check if logging is enabled (optional gating)
  const debugEnabled = process.env.DEBUG_HTML_LOGS === "true";
  if (!debugEnabled) {
    // Always log on errors, but can be gated if desired
    // For now, we'll always log when this function is called
  }

  // Ensure logs directory exists
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }

  // Get page info
  const url = page.url();
  const timestamp = new Date().toISOString();
  const html = await page.content();

  // Build log content
  const logContent = `<!--
HTML Snapshot Log
==================
Timestamp: ${timestamp}
URL: ${url}
${errorMessage ? `Error: ${errorMessage}` : ""}
-->

${html}
`;

  // Write to fixed filename (overwrites on each call)
  const filename = `${label}.html`;
  const filepath = join(LOGS_DIR, filename);
  writeFileSync(filepath, logContent, "utf-8");

  return filepath;
}

/**
 * Captures a screenshot and saves it to data/logs/.
 * Overwrites the same file on each call.
 *
 * @param page - Puppeteer page
 * @param label - Short label for the screenshot file (e.g. "error-form-guid", "step2")
 * @returns Path to the written screenshot file
 */
export async function logScreenshot(page: Page, label: string): Promise<string> {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }

  const filename = `${label}.png`;
  const filepath = join(LOGS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });

  return filepath;
}
