import { Router, Request, Response } from "express";
import { loadSettings, saveSettings, getSettingsForClient, type Settings } from "../config/settings.js";
import { wasteTypes, transportTypes, trailerTypes, sites } from "../config/selectors.js";

export const settingsRouter = Router();

/**
 * GET /api/settings
 * Returns current settings and available options.
 */
settingsRouter.get("/", (_req: Request, res: Response) => {
  const settings = getSettingsForClient();

  res.json({
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
  });
});

/**
 * PUT /api/settings
 * Updates settings.
 */
settingsRouter.put("/", (req: Request, res: Response) => {
  const updates = req.body as Partial<Settings>;

  try {
    saveSettings(updates);
    const updated = loadSettings();
    res.json({ success: true, settings: updated });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ error: "Failed to save settings" });
  }
});
