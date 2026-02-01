import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import * as env from "./env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../../data");
const SETTINGS_PATH = join(DATA_DIR, "settings.json");

/**
 * User settings that can override env defaults.
 */
export interface Settings {
  // Step 1: Your details
  email: string;
  blueBadgeHolder: boolean;
  residentialOrCharity: string;
  whoBringsWaste: string;
  charityId: string;
  charityNumber: string;
  postcode: string;
  addressValue: string;
  addressLabel: string;
  commercialProviderName: string;
  wasteCarriersLicence: string;
  licenceExpiry: string;
  transferNoteNumber: string;
  hiringVan: boolean;

  // Step 2: Waste defaults (array of field IDs like ["FF34", "FF48"])
  wasteDefaults: string[];

  // Step 3: Vehicle
  vehicleRegistration: string;
  transportType: string;
  trailerType: string;
  site: string;
}

/**
 * Returns default settings from environment variables.
 */
function getDefaults(): Settings {
  return {
    email: env.EMAIL,
    blueBadgeHolder: env.BLUE_BADGE_HOLDER,
    residentialOrCharity: env.RESIDENTIAL_OR_CHARITY,
    whoBringsWaste: env.WHO_BRINGS_WASTE,
    charityId: env.CHARITY_ID,
    charityNumber: env.CHARITY_NUMBER,
    postcode: env.POSTCODE,
    addressValue: env.ADDRESS_VALUE,
    addressLabel: "",
    commercialProviderName: env.COMMERCIAL_PROVIDER_NAME,
    wasteCarriersLicence: env.WASTE_CARRIERS_LICENCE,
    licenceExpiry: env.LICENCE_EXPIRY,
    transferNoteNumber: env.TRANSFER_NOTE_NUMBER,
    hiringVan: env.HIRING_VAN,
    wasteDefaults: env.WASTE_DEFAULTS,
    vehicleRegistration: env.VEHICLE_REGISTRATION,
    transportType: env.TRANSPORT_TYPE,
    trailerType: env.TRAILER_TYPE,
    site: env.SITE,
  };
}

/**
 * Loads settings from file, merged with env defaults.
 */
export function loadSettings(): Settings {
  const defaults = getDefaults();

  if (!existsSync(SETTINGS_PATH)) {
    return defaults;
  }

  try {
    const raw = readFileSync(SETTINGS_PATH, "utf-8");
    const overrides = JSON.parse(raw) as Partial<Settings>;
    return { ...defaults, ...overrides };
  } catch {
    console.warn("Failed to read settings.json, using defaults");
    return defaults;
  }
}

/**
 * Saves settings overrides to file.
 */
export function saveSettings(settings: Partial<Settings>): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Load existing and merge
  const current = loadSettings();
  const merged = { ...current, ...settings };

  writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

/**
 * Returns settings with sensitive fields masked for client display.
 */
export function getSettingsForClient(): Settings {
  const settings = loadSettings();
  // Don't mask anything for now - user needs to see their own data
  return settings;
}
