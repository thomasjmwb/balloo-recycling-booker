/**
 * Integration test for settings loading and option lists.
 *
 * Validates that env/settings.json config loads correctly,
 * all required fields are populated, and dropdown option
 * arrays match the expected counts and shapes.
 *
 * Also spins up the Express server on a random port and makes
 * a real HTTP request to GET /api/settings to catch server-level
 * issues (port conflicts, route wiring, middleware errors).
 *
 * Run: npm run test:settings  (from server/)
 */

import { describe, it, expect, afterAll } from "vitest";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { loadSettings, getSettingsForClient, type Settings } from "../config/settings.js";
import { wasteTypes, transportTypes, trailerTypes, sites } from "../config/selectors.js";
import { app } from "../app.js";

describe("Settings — loading and option lists", () => {
  // --- Settings load ---

  it("should load settings with all required fields and correct types", () => {
    const settings = loadSettings();

    expect(settings).toBeDefined();

    const stringFields: (keyof Settings)[] = [
      "email",
      "residentialOrCharity",
      "whoBringsWaste",
      "charityId",
      "charityNumber",
      "postcode",
      "addressValue",
      "addressLabel",
      "commercialProviderName",
      "wasteCarriersLicence",
      "licenceExpiry",
      "transferNoteNumber",
      "vehicleRegistration",
      "transportType",
      "trailerType",
      "site",
    ];
    for (const field of stringFields) {
      expect(typeof settings[field]).toBe("string");
    }

    expect(typeof settings.blueBadgeHolder).toBe("boolean");
    expect(typeof settings.hiringVan).toBe("boolean");
    expect(Array.isArray(settings.wasteDefaults)).toBe(true);
  });

  // --- Client settings ---

  it("should return client settings with the same shape as loadSettings", () => {
    const settings = loadSettings();
    const clientSettings = getSettingsForClient();

    expect(Object.keys(clientSettings).sort()).toEqual(
      Object.keys(settings).sort()
    );
  });

  // --- Required fields for booking flow ---

  it("should have required booking fields populated", () => {
    const settings = loadSettings();

    expect(settings.email.length).toBeGreaterThan(0);
    expect(settings.postcode.length).toBeGreaterThan(0);
    expect(settings.vehicleRegistration.length).toBeGreaterThan(0);
  });

  // --- Waste types ---

  it("should have 27 waste types with id and label", () => {
    expect(wasteTypes).toHaveLength(27);
    for (const w of wasteTypes) {
      expect(typeof w.id).toBe("string");
      expect(w.id.length).toBeGreaterThan(0);
      expect(typeof w.label).toBe("string");
      expect(w.label.length).toBeGreaterThan(0);
    }
  });

  // --- Transport types ---

  it("should have 12 transport types", () => {
    expect(transportTypes).toHaveLength(12);
    for (const t of transportTypes) {
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThan(0);
    }
  });

  // --- Trailer types ---

  it("should have 3 trailer types", () => {
    expect(trailerTypes).toHaveLength(3);
    for (const t of trailerTypes) {
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThan(0);
    }
  });

  // --- Sites ---

  it("should have 9 recycling centre sites", () => {
    expect(sites).toHaveLength(9);
    for (const s of sites) {
      expect(typeof s).toBe("string");
      expect(s.length).toBeGreaterThan(0);
    }
  });

  // --- Full response contract (mirrors GET /api/settings) ---

  it("should produce a valid GET /api/settings response shape", () => {
    const settings = getSettingsForClient();
    const response = {
      settings,
      options: {
        wasteTypes: wasteTypes.map((w) => ({ id: w.id, label: w.label })),
        transportTypes,
        trailerTypes,
        sites,
        residentialOrCharityOptions: ["Residential", "Charity"],
        whoBringsWasteOptions: [
          "I am bringing my own household waste",
          "A relative, friend or neighbour is bringing household waste on my behalf",
          "A commercial waste disposal provider is bringing my household waste for payment",
          "Commercial gardener/landscaper",
        ],
      },
    };

    expect(response.settings).toBeDefined();
    expect(response.options).toBeDefined();
    expect(response.options.wasteTypes).toHaveLength(27);
    expect(response.options.transportTypes).toHaveLength(12);
    expect(response.options.trailerTypes).toHaveLength(3);
    expect(response.options.sites).toHaveLength(9);
    expect(response.options.residentialOrCharityOptions).toEqual([
      "Residential",
      "Charity",
    ]);
    expect(response.options.whoBringsWasteOptions).toHaveLength(4);

    for (const wt of response.options.wasteTypes) {
      expect(wt).toHaveProperty("id");
      expect(wt).toHaveProperty("label");
    }
  });
});

// --- HTTP-level tests (catches server startup / route wiring issues) ---

describe("Settings — HTTP endpoint (GET /api/settings)", () => {
  let server: Server;
  let baseUrl: string;

  // Start the Express app on a random free port
  const serverReady = new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  afterAll(() => {
    server?.close();
  });

  it("should return 200 with settings and options", async () => {
    await serverReady;
    const res = await fetch(`${baseUrl}/api/settings`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("settings");
    expect(body).toHaveProperty("options");
  });

  it("should return all expected option arrays via HTTP", async () => {
    await serverReady;
    const res = await fetch(`${baseUrl}/api/settings`);
    const body = await res.json();

    expect(body.options.wasteTypes).toHaveLength(27);
    expect(body.options.transportTypes).toHaveLength(12);
    expect(body.options.trailerTypes).toHaveLength(3);
    expect(body.options.sites).toHaveLength(9);
    expect(body.options.residentialOrCharityOptions).toEqual(["Residential", "Charity"]);
    expect(body.options.whoBringsWasteOptions).toHaveLength(4);
  });

  it("should return settings with correct field types via HTTP", async () => {
    await serverReady;
    const res = await fetch(`${baseUrl}/api/settings`);
    const { settings } = await res.json();

    expect(typeof settings.email).toBe("string");
    expect(typeof settings.blueBadgeHolder).toBe("boolean");
    expect(Array.isArray(settings.wasteDefaults)).toBe(true);
  });

  it("should respond to GET /api/health", async () => {
    await serverReady;
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
