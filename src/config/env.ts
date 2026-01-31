import "dotenv/config";

/**
 * Environment configuration loaded from .env (local dev) or process.env (production).
 * Validates required variables at startup.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

/** Base URL for the recycling booking website */
export const BOOKING_URL = requireEnv("BOOKING_URL");

/**
 * Form parameters as JSON.
 * Keys should match ASPX form field names (name attributes).
 * Example: {"txtAddress":"123 Main St","ddlArea":"North"}
 */
export function getFormParams(): Record<string, string> {
  const raw = optionalEnv("FORM_PARAMS", "{}");
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([, v]) => v !== undefined && v !== null && typeof v === "string"
        ) as [string, string][]
      );
    }
  } catch {
    throw new Error(
      "FORM_PARAMS must be valid JSON object. Example: {\"fieldName\":\"value\"}"
    );
  }
  return {};
}

/** Run browser in headless mode (default: true) */
export const HEADLESS = optionalEnv("HEADLESS", "true") !== "false";
