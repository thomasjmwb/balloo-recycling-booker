import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../../.env") });

/**
 * Environment configuration for the server.
 * Loads from .env (local dev) or process.env (production).
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

function optionalBool(name: string, defaultValue: boolean): boolean {
  const val = process.env[name];
  if (val === undefined) return defaultValue;
  return val.toLowerCase() === "true" || val === "1";
}

// URLs
export const BOOKING_URL = requireEnv("BOOKING_URL");
export const ADDRESS_LOOKUP_URL = optionalEnv(
  "ADDRESS_LOOKUP_URL",
  "https://selfservice.ardsandnorthdown.gov.uk/core/addresslookup"
);
export const SLOTS_API_URL = optionalEnv(
  "SLOTS_API_URL",
  "https://selfservice.ardsandnorthdown.gov.uk/renderform/getavailabletimeslots"
);
export const REFRESH_API_URL = optionalEnv(
  "REFRESH_API_URL",
  "https://selfservice.ardsandnorthdown.gov.uk/ajax/refresh"
);

// Server config
export const PORT = parseInt(optionalEnv("PORT", "3000"), 10);
export const HEADLESS = optionalBool("HEADLESS", true);

// Form defaults - Step 1 (Your details)
export const EMAIL = optionalEnv("EMAIL", "");
export const BLUE_BADGE_HOLDER = optionalBool("BLUE_BADGE_HOLDER", false);
export const RESIDENTIAL_OR_CHARITY = optionalEnv("RESIDENTIAL_OR_CHARITY", "Residential");
export const WHO_BRINGS_WASTE = optionalEnv("WHO_BRINGS_WASTE", "I am bringing my own household waste");
export const CHARITY_ID = optionalEnv("CHARITY_ID", "");
export const CHARITY_NUMBER = optionalEnv("CHARITY_NUMBER", "");
export const POSTCODE = optionalEnv("POSTCODE", "");
export const ADDRESS_VALUE = optionalEnv("ADDRESS_VALUE", "");
export const COMMERCIAL_PROVIDER_NAME = optionalEnv("COMMERCIAL_PROVIDER_NAME", "");
export const WASTE_CARRIERS_LICENCE = optionalEnv("WASTE_CARRIERS_LICENCE", "");
export const LICENCE_EXPIRY = optionalEnv("LICENCE_EXPIRY", "");
export const TRANSFER_NOTE_NUMBER = optionalEnv("TRANSFER_NOTE_NUMBER", "");
export const HIRING_VAN = optionalBool("HIRING_VAN", false);

// Form defaults - Step 3 (Your vehicle)
export const VEHICLE_REGISTRATION = optionalEnv("VEHICLE_REGISTRATION", "");
export const TRANSPORT_TYPE = optionalEnv("TRANSPORT_TYPE", "Car");
export const TRAILER_TYPE = optionalEnv("TRAILER_TYPE", "No Trailer");
export const SITE = optionalEnv("SITE", "Balloo");

// Form defaults - Step 2 (Waste types) - comma-separated field IDs
export const WASTE_DEFAULTS = optionalEnv("WASTE_DEFAULTS", "FF34,FF48,FF33,FF50").split(",").filter(Boolean);
