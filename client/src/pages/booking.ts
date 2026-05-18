import { api } from "../api.js";
import { logError } from "../errorLog.js";

function logTimezoneDebug(label: string): void {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = -new Date().getTimezoneOffset();
  const offsetStr =
    (offset >= 0 ? "+" : "-") +
    String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0") +
    ":" +
    String(Math.abs(offset) % 60).padStart(2, "0");
  const info = {
    label,
    timeZone: tz,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    timezoneOffsetString: "UTC" + offsetStr,
    currentTime: new Date().toString(),
    currentTimeISO: new Date().toISOString(),
  };
  console.log("[Balloo] Timezone debug:", info);
}

interface WasteOption {
  id: string;
  label: string;
}

interface DateOption {
  value: string;
  label: string;
}

interface SlotOption {
  value: string;
  label: string;
}

let sessionId: string | null = null;
let formGuid: string | null = null;
let wasteOptions: WasteOption[] = [];
let wasteDefaults: string[] = [];
let dates: DateOption[] = [];
let slots: SlotOption[] = [];

export async function renderBookingPage(container: HTMLElement): Promise<void> {
  try {
    // Load settings for waste options and defaults
    const { settings, options } = await api.getSettings();
    wasteOptions = options.wasteTypes;
    wasteDefaults = settings.wasteDefaults || [];

    container.innerHTML = `
      <div class="booking-page">
        <h1>Book Recycling Visit</h1>
        
        <div id="step-start" class="step">
          <p>Click Start to begin booking with your saved settings.</p>
          
          <details class="waste-details">
            <summary>
              <span>Customize waste types (optional)</span>
              <span id="waste-summary" class="waste-summary"></span>
            </summary>
            <div id="waste-list" class="checkbox-list"></div>
          </details>

          <button id="btn-start" class="btn primary">Start Booking</button>
        </div>

        <div id="step-date" class="step hidden">
          <h2>Select Date</h2>
          <select id="date-select" class="select">
            <option value="">Choose a date...</option>
          </select>
          <div id="slots-container" class="hidden">
            <h3>Available Times</h3>
            <select id="slot-select" class="select">
              <option value="">Choose a time...</option>
            </select>
            <button id="btn-confirm" class="btn primary">Confirm Booking</button>
          </div>
        </div>

        <div id="step-done" class="step hidden">
          <h2>Booking Confirmed!</h2>
          <p>Your recycling centre visit has been booked.</p>
          <button id="btn-reset" class="btn">Book Another</button>
        </div>

        <div id="loading" class="loading hidden">
          <div class="spinner"></div>
          <p>Processing...</p>
        </div>

        <div id="error" class="error hidden"></div>
      </div>
    `;

    // Render waste checkboxes with defaults (checked items first)
    const list = document.getElementById("waste-list");
    if (list) {
      const sorted = [...wasteOptions].sort(
        (a, b) => (wasteDefaults.includes(b.id) ? 1 : 0) - (wasteDefaults.includes(a.id) ? 1 : 0)
      );
      list.innerHTML = sorted
        .map(
          (w) => `
          <label class="checkbox-item">
            <input type="checkbox" value="${w.id}" data-label="${escapeHtml(w.label)}" ${wasteDefaults.includes(w.id) ? "checked" : ""}>
            <span>${escapeHtml(w.label)}</span>
          </label>
        `
        )
        .join("");
    }

    updateWasteSummary();

    // Bind events
    document.getElementById("btn-start")?.addEventListener("click", startBooking);
    document.getElementById("date-select")?.addEventListener("change", onDateChange);
    document.getElementById("waste-list")?.addEventListener("change", updateWasteSummary);
    document.getElementById("btn-confirm")?.addEventListener("click", confirmBooking);
    document.getElementById("btn-reset")?.addEventListener("click", resetBooking);
  } catch (err) {
    logError("Booking Init", "Page could not load", err);
    container.innerHTML = `
      <div class="booking-page">
        <div class="error" style="display:block;">
          <strong>Initialization Failed</strong>
          <p>The booking page could not load. Please check the browser console for details, and verify your internet connection and certificate validity.</p>
        </div>
      </div>
    `;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function updateWasteSummary(): void {
  const checkboxes = document.querySelectorAll("#waste-list input:checked");
  const labels = Array.from(checkboxes).map(
    (cb) => (cb as HTMLInputElement).dataset.label || (cb as HTMLInputElement).value
  );
  const summary = document.getElementById("waste-summary");
  if (summary) {
    summary.textContent = labels.length > 0 ? ` — ${labels.join(", ")}` : "";
  }
}

function showStep(stepId: string): void {
  document.querySelectorAll(".step").forEach((el) => el.classList.add("hidden"));
  document.getElementById(stepId)?.classList.remove("hidden");
}

function showLoading(show: boolean): void {
  document.getElementById("loading")?.classList.toggle("hidden", !show);
}

function showError(message: string): void {
  const el = document.getElementById("error");
  if (el) {
    el.textContent = message;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 5000);
  }
}

async function startBooking(): Promise<void> {
  const checkboxes = document.querySelectorAll("#waste-list input:checked");
  const selectedIds = Array.from(checkboxes).map((cb) => (cb as HTMLInputElement).value);

  if (selectedIds.length === 0) {
    showError("Please select at least one waste type.");
    return;
  }

  showLoading(true);
  try {
    const result = await api.startBooking(selectedIds);
    sessionId = result.sessionId;
    formGuid = result.formGuid;
    dates = result.dates;

    // Populate date dropdown
    const select = document.getElementById("date-select") as HTMLSelectElement;
    if (select) {
      select.innerHTML =
        '<option value="">Choose a date...</option>' +
        dates.map((d) => `<option value="${d.value}">${d.label}</option>`).join("");
    }

    showStep("step-date");
  } catch (err) {
    logError("Booking Start", "Failed to start booking", err);
    showError("Connection error: Failed to start booking. Please check your internet connection and ensure certificates are valid.");
  } finally {
    showLoading(false);
  }
}

async function onDateChange(e: Event): Promise<void> {
  const select = e.target as HTMLSelectElement;
  const dateValue = select.value;

  if (!dateValue || !sessionId) {
    document.getElementById("slots-container")?.classList.add("hidden");
    return;
  }

  showLoading(true);
  try {
    logTimezoneDebug("before getSlots");
    const result = await api.getSlots(sessionId, dateValue);
    slots = result.slots;
    logTimezoneDebug("after getSlots");
    console.log("[Balloo] First 3 slots received:", slots.slice(0, 3));

    const slotSelect = document.getElementById("slot-select") as HTMLSelectElement;
    if (slotSelect) {
      slotSelect.innerHTML =
        '<option value="">Choose a time...</option>' +
        slots.map((s) => `<option value="${s.value}">${s.label}</option>`).join("");
    }

    document.getElementById("slots-container")?.classList.remove("hidden");
  } catch (err) {
    logError("Booking Slots", "Failed to load time slots", err);
    showError("Connection error: Failed to load time slots. Please check your internet connection and ensure certificates are valid.");
  } finally {
    showLoading(false);
  }
}

async function confirmBooking(): Promise<void> {
  if (!sessionId) return;

  const dateSelect = document.getElementById("date-select") as HTMLSelectElement;
  const slotSelect = document.getElementById("slot-select") as HTMLSelectElement;
  const slotValue = slotSelect?.value;

  if (!slotValue) {
    showError("Please select a time slot.");
    return;
  }

  const dateLabel = dateSelect?.selectedOptions[0]?.textContent || "";
  const slotLabel = slotSelect?.selectedOptions[0]?.textContent || "";

  showLoading(true);
  try {
    await api.confirmBooking(sessionId, slotValue, dateLabel, slotLabel);
    sessionId = null;
    formGuid = null;
    showStep("step-done");
  } catch (err) {
    logError("Booking Confirm", "Failed to confirm booking", err);
    showError("Connection error: Failed to confirm booking. Please check your internet connection and try again.");
  } finally {
    showLoading(false);
  }
}

function resetBooking(): void {
  sessionId = null;
  formGuid = null;
  dates = [];
  slots = [];
  showStep("step-start");
}
