import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "../../..");
const envPaths = [
  join(projectRoot, ".env"),
  join(process.cwd(), ".env"),
  join(__dirname, "../../.env"),
];
let loaded = false;
for (const p of envPaths) {
  if (existsSync(p)) {
    config({ path: p });
    loaded = true;
    break;
  }
}
if (!loaded) {
  throw new Error(
    "No .env file found. Create one from .env.example (e.g. cp .env.example .env) and configure required variables."
  );
}

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

// Router DNS auto-fix (see server/src/routerDns.ts and docs/router-dns-setup.md)
export const ROUTER_DNS_AUTOFIX = optionalBool("ROUTER_DNS_AUTOFIX", false);
// How often to re-check router DNS after startup (0 = startup check only).
export const ROUTER_DNS_CHECK_INTERVAL_MS = parseInt(
  optionalEnv("ROUTER_DNS_CHECK_INTERVAL_MS", "300000"),
  10
);
export const ROUTER_HOST = optionalEnv("ROUTER_HOST", "192.168.50.1");
export const ROUTER_SSH_PORT = parseInt(optionalEnv("ROUTER_SSH_PORT", "1025"), 10);
export const ROUTER_SSH_USER = optionalEnv("ROUTER_SSH_USER", "admin");
export const ROUTER_SSH_KEY = optionalEnv("ROUTER_SSH_KEY", "");
export const LOCAL_HOSTNAME = optionalEnv("LOCAL_HOSTNAME", "recycling.local.home");
export const LOCAL_HOST_IP = optionalEnv("LOCAL_HOST_IP", "192.168.50.94");
