import { Router, Request, Response } from "express";
import { BookingDriver } from "../puppeteer/driver.js";
import { fillStep1, fillStep2, fillStep3, fillStep4, getAvailableDates, selectDateAndGetSlots, selectSlotAndSubmit } from "../puppeteer/steps.js";
import { loadSettings } from "../config/settings.js";
import { wasteTypes } from "../config/selectors.js";
import { SLOTS_API_URL } from "../config/env.js";

export const bookingRouter = Router();

// In-memory session storage (in production, use Redis or similar)
const sessions = new Map<string, BookingDriver>();

/**
 * POST /api/booking/start
 * Starts a new booking session, fills step 1, stops at step 2 (waste selection).
 */
bookingRouter.post("/start", async (_req: Request, res: Response) => {
  const sessionId = crypto.randomUUID();
  const driver = new BookingDriver();

  try {
    // Start browser and navigate
    const { formGuid } = await driver.start();

    // Fill step 1 with saved settings
    const settings = loadSettings();
    await fillStep1(driver, settings);

    // Store session
    sessions.set(sessionId, driver);

    // Return waste options for user selection
    res.json({
      sessionId,
      formGuid,
      step: "trash",
      wasteTypes: wasteTypes.map((w) => ({
        id: w.id,
        label: w.label,
        defaultChecked: settings.wasteDefaults.includes(w.id),
      })),
    });
  } catch (error) {
    await driver.close();
    console.error("Error starting booking:", error);
    res.status(500).json({ error: "Failed to start booking" });
  }
});

/**
 * POST /api/booking/trash
 * Submits waste selection, fills steps 3-4, reaches step 5.
 * Body: { sessionId, wasteIds: string[] }
 */
bookingRouter.post("/trash", async (req: Request, res: Response) => {
  const { sessionId, wasteIds } = req.body as { sessionId: string; wasteIds: string[] };

  const driver = sessions.get(sessionId);
  if (!driver) {
    return res.status(404).json({ error: "Session not found" });
  }

  try {
    // Fill step 2 with selected waste types
    await fillStep2(driver, wasteIds);

    // Fill step 3 (vehicle) with saved settings
    const settings = loadSettings();
    await fillStep3(driver, settings);

    // Fill step 4 (terms)
    await fillStep4(driver);

    // Now at step 5: get available dates
    const dates = await getAvailableDates(driver);
    const formGuid = driver.getFormGuid();

    res.json({
      step: "booking",
      formGuid,
      dates,
    });
  } catch (error) {
    console.error("Error submitting waste:", error);
    res.status(500).json({ error: "Failed to submit waste selection" });
  }
});

/**
 * GET /api/booking/slots
 * Gets available time slots for a date.
 * Query: sessionId, date
 */
bookingRouter.get("/slots", async (req: Request, res: Response) => {
  const { sessionId, date } = req.query as { sessionId: string; date: string };

  const driver = sessions.get(sessionId);
  if (!driver) {
    return res.status(404).json({ error: "Session not found" });
  }

  try {
    const slots = await selectDateAndGetSlots(driver, date);
    res.json({ slots });
  } catch (error) {
    console.error("Error getting slots:", error);
    res.status(500).json({ error: "Failed to get time slots" });
  }
});

/**
 * POST /api/booking/confirm
 * Selects time slot and completes booking.
 * Body: { sessionId, slotValue }
 */
bookingRouter.post("/confirm", async (req: Request, res: Response) => {
  const { sessionId, slotValue } = req.body as { sessionId: string; slotValue: string };

  const driver = sessions.get(sessionId);
  if (!driver) {
    return res.status(404).json({ error: "Session not found" });
  }

  try {
    await selectSlotAndSubmit(driver, slotValue);

    // Take screenshot of confirmation
    await driver.screenshot("data/confirmation.png");

    // Clean up
    await driver.close();
    sessions.delete(sessionId);

    res.json({
      success: true,
      message: "Booking confirmed!",
    });
  } catch (error) {
    console.error("Error confirming booking:", error);
    res.status(500).json({ error: "Failed to confirm booking" });
  }
});

/**
 * POST /api/booking/cancel
 * Cancels a booking session.
 */
bookingRouter.post("/cancel", async (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId: string };

  const driver = sessions.get(sessionId);
  if (driver) {
    await driver.close();
    sessions.delete(sessionId);
  }

  res.json({ success: true });
});
