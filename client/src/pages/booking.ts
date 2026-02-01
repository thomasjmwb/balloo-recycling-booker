import { api } from "../api.js";

interface WasteType {
  id: string;
  label: string;
  defaultChecked: boolean;
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
let wasteTypes: WasteType[] = [];
let dates: DateOption[] = [];
let slots: SlotOption[] = [];

export function renderBookingPage(container: HTMLElement): void {
  container.innerHTML = `
    <div class="booking-page">
      <h1>Book Recycling Visit</h1>
      
      <div id="step-start" class="step">
        <p>Click Start to begin booking with your saved settings.</p>
        <button id="btn-start" class="btn primary">Start Booking</button>
      </div>

      <div id="step-trash" class="step hidden">
        <h2>Select Waste Types</h2>
        <div id="waste-list" class="checkbox-list"></div>
        <button id="btn-submit-trash" class="btn primary">Continue</button>
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

  // Bind events
  document.getElementById("btn-start")?.addEventListener("click", startBooking);
  document.getElementById("btn-submit-trash")?.addEventListener("click", submitTrash);
  document.getElementById("date-select")?.addEventListener("change", onDateChange);
  document.getElementById("btn-confirm")?.addEventListener("click", confirmBooking);
  document.getElementById("btn-reset")?.addEventListener("click", resetBooking);
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
  showLoading(true);
  try {
    const result = await api.startBooking();
    sessionId = result.sessionId;
    formGuid = result.formGuid;
    wasteTypes = result.wasteTypes;

    // Render waste checkboxes
    const list = document.getElementById("waste-list");
    if (list) {
      list.innerHTML = wasteTypes
        .map(
          (w) => `
          <label class="checkbox-item">
            <input type="checkbox" value="${w.id}" ${w.defaultChecked ? "checked" : ""}>
            <span>${w.label}</span>
          </label>
        `
        )
        .join("");
    }

    showStep("step-trash");
  } catch (err) {
    showError("Failed to start booking. Please try again.");
    console.error(err);
  } finally {
    showLoading(false);
  }
}

async function submitTrash(): Promise<void> {
  if (!sessionId) return;

  const checkboxes = document.querySelectorAll("#waste-list input:checked");
  const selectedIds = Array.from(checkboxes).map((cb) => (cb as HTMLInputElement).value);

  if (selectedIds.length === 0) {
    showError("Please select at least one waste type.");
    return;
  }

  showLoading(true);
  try {
    const result = await api.submitTrash(sessionId, selectedIds);
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
    showError("Failed to submit waste selection.");
    console.error(err);
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
    const result = await api.getSlots(sessionId, dateValue);
    slots = result.slots;

    const slotSelect = document.getElementById("slot-select") as HTMLSelectElement;
    if (slotSelect) {
      slotSelect.innerHTML =
        '<option value="">Choose a time...</option>' +
        slots.map((s) => `<option value="${s.value}">${s.label}</option>`).join("");
    }

    document.getElementById("slots-container")?.classList.remove("hidden");
  } catch (err) {
    showError("Failed to load time slots.");
    console.error(err);
  } finally {
    showLoading(false);
  }
}

async function confirmBooking(): Promise<void> {
  if (!sessionId) return;

  const slotSelect = document.getElementById("slot-select") as HTMLSelectElement;
  const slotValue = slotSelect?.value;

  if (!slotValue) {
    showError("Please select a time slot.");
    return;
  }

  showLoading(true);
  try {
    await api.confirmBooking(sessionId, slotValue);
    sessionId = null;
    formGuid = null;
    showStep("step-done");
  } catch (err) {
    showError("Failed to confirm booking.");
    console.error(err);
  } finally {
    showLoading(false);
  }
}

function resetBooking(): void {
  sessionId = null;
  formGuid = null;
  wasteTypes = [];
  dates = [];
  slots = [];
  showStep("step-start");
}
