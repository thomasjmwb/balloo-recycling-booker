import { api, type Settings, type SettingsOptions, type BookingRecord } from "../api.js";
import { logError, getErrors, clearErrors } from "../errorLog.js";

const APP_VERSION: string = __APP_VERSION__;

let settings: Settings | null = null;
let options: SettingsOptions | null = null;

export async function renderSettingsPage(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="settings-page">
      <h1>Settings</h1>
      <div id="settings-loading" class="loading">Loading...</div>
      <form id="settings-form" class="form hidden"></form>
      <div id="settings-message" class="message hidden"></div>
      <div id="booking-history"></div>
      <div id="error-log"></div>
      <p class="text-muted" style="text-align:center; margin-top:2rem;">v${APP_VERSION}</p>
    </div>
  `;

  renderErrorLog();

  try {
    const result = await api.getSettings();
    settings = result.settings;
    options = result.options;
    renderForm();
  } catch (err) {
    logError("Settings Load", "Failed to load settings", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    container.innerHTML = `
      <div class="settings-page">
        <h1>Settings</h1>
        <p class="error">Failed to load settings: ${detail}. See error log below for details.</p>
        <div id="error-log"></div>
        <p class="text-muted" style="text-align:center; margin-top:2rem;">v${APP_VERSION}</p>
      </div>`;
    renderErrorLog();
    return;
  }

  try {
    const { bookings } = await api.getBookingHistory();
    renderBookingHistory(bookings);
  } catch (err) {
    logError("Settings History", "Failed to load booking history", err);
    const historyContainer = document.getElementById("booking-history");
    if (historyContainer) {
      historyContainer.innerHTML = `
        <section class="form-section">
          <h2>Booking History</h2>
          <p class="text-muted" style="color: orange;">Could not load booking history right now. Check your connection.</p>
        </section>`;
    }
    renderErrorLog();
  }
}

function renderForm(): void {
  const form = document.getElementById("settings-form");
  const loading = document.getElementById("settings-loading");

  if (!form || !settings || !options) return;

  loading?.classList.add("hidden");
  form.classList.remove("hidden");

  form.innerHTML = `
    <section class="form-section">
      <h2>Your Details</h2>
      
      <label class="form-field">
        <span>Email</span>
        <input type="email" name="email" value="${settings.email}" placeholder="your@email.com">
      </label>

      <label class="form-field checkbox">
        <input type="checkbox" name="blueBadgeHolder" ${settings.blueBadgeHolder ? "checked" : ""}>
        <span>Blue badge holder</span>
      </label>

      <label class="form-field">
        <span>Booking type</span>
        <select name="residentialOrCharity">
          ${options.residentialOrCharityOptions.map((opt) => `<option value="${opt}" ${settings?.residentialOrCharity === opt ? "selected" : ""}>${opt}</option>`).join("")}
        </select>
      </label>

      <label class="form-field">
        <span>Who brings waste</span>
        <select name="whoBringsWaste">
          ${options.whoBringsWasteOptions.map((opt) => `<option value="${opt}" ${settings?.whoBringsWaste === opt ? "selected" : ""}>${opt}</option>`).join("")}
        </select>
      </label>

      <label class="form-field">
        <span>Postcode</span>
        <input type="text" name="postcode" value="${settings.postcode}" placeholder="BT19 1AA">
      </label>

      <label class="form-field checkbox">
        <input type="checkbox" name="hiringVan" ${settings.hiringVan ? "checked" : ""}>
        <span>Hiring a van</span>
      </label>
    </section>

    <section class="form-section">
      <h2>Vehicle</h2>

      <label class="form-field">
        <span>Registration</span>
        <input type="text" name="vehicleRegistration" value="${settings.vehicleRegistration}" placeholder="AB12 CDE">
      </label>

      <label class="form-field">
        <span>Transport type</span>
        <select name="transportType">
          ${options.transportTypes.map((opt) => `<option value="${opt}" ${settings?.transportType === opt ? "selected" : ""}>${opt}</option>`).join("")}
        </select>
      </label>

      <label class="form-field">
        <span>Trailer type</span>
        <select name="trailerType">
          ${options.trailerTypes.map((opt) => `<option value="${opt}" ${settings?.trailerType === opt ? "selected" : ""}>${opt}</option>`).join("")}
        </select>
      </label>

      <label class="form-field">
        <span>Site</span>
        <select name="site">
          ${options.sites.map((opt) => `<option value="${opt}" ${settings?.site === opt ? "selected" : ""}>${opt}</option>`).join("")}
        </select>
      </label>
    </section>

    <section class="form-section">
      <h2>Default Waste Types</h2>
      <div class="checkbox-list">
        ${[...options.wasteTypes]
          .sort(
            (a, b) =>
              (settings?.wasteDefaults.includes(b.id) ? 1 : 0) - (settings?.wasteDefaults.includes(a.id) ? 1 : 0)
          )
          .map((w) => `
          <label class="checkbox-item">
            <input type="checkbox" name="wasteDefaults" value="${w.id}" ${settings?.wasteDefaults.includes(w.id) ? "checked" : ""}>
            <span>${w.label}</span>
          </label>
        `)
          .join("")}
      </div>
    </section>

    <button type="submit" class="btn primary">Save Settings</button>
  `;

  form.addEventListener("submit", handleSubmit);
}

async function handleSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);

  // Build settings object
  const updates: Partial<Settings> = {
    email: formData.get("email") as string,
    blueBadgeHolder: formData.has("blueBadgeHolder"),
    residentialOrCharity: formData.get("residentialOrCharity") as string,
    whoBringsWaste: formData.get("whoBringsWaste") as string,
    postcode: formData.get("postcode") as string,
    hiringVan: formData.has("hiringVan"),
    vehicleRegistration: formData.get("vehicleRegistration") as string,
    transportType: formData.get("transportType") as string,
    trailerType: formData.get("trailerType") as string,
    site: formData.get("site") as string,
    wasteDefaults: formData.getAll("wasteDefaults") as string[],
  };

  try {
    const result = await api.saveSettings(updates);
    settings = result.settings;
    showMessage("Settings saved!", "success");
  } catch (err) {
    logError("Settings Save", "Failed to save settings", err);
    showMessage("Failed to save settings. Please check your connection and try again.", "error");
  }
}

function renderBookingHistory(bookings: BookingRecord[]): void {
  const container = document.getElementById("booking-history");
  if (!container) return;

  if (bookings.length === 0) {
    container.innerHTML = `
      <section class="form-section">
        <h2>Booking History</h2>
        <p class="text-muted">No bookings yet.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="form-section">
      <h2>Booking History</h2>
      <ul class="booking-history-list">
        ${bookings
          .map((b) => {
            const date = new Date(b.confirmedAt);
            const submitted = date.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return `
            <li class="booking-history-item">
              <div class="booking-history-detail">
                <span class="booking-history-date">${b.dateLabel}</span>
                <span class="booking-history-slot">${b.slotLabel}</span>
              </div>
              <span class="booking-history-submitted">Submitted ${submitted}</span>
            </li>`;
          })
          .join("")}
      </ul>
    </section>
  `;
}

function showMessage(text: string, type: "success" | "error"): void {
  const el = document.getElementById("settings-message");
  if (el) {
    el.textContent = text;
    el.className = `message ${type}`;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3000);
  }
}

function renderErrorLog(): void {
  const container = document.getElementById("error-log");
  if (!container) return;

  const errors = getErrors();

  if (errors.length === 0) {
    container.innerHTML = `
      <section class="form-section">
        <h2>Error Log</h2>
        <p class="text-muted">No errors recorded.</p>
      </section>`;
    return;
  }

  container.innerHTML = `
    <section class="form-section">
      <h2>Error Log</h2>
      <p class="text-muted">${errors.length} error(s) — copy these when reporting issues.</p>
      <ul class="error-log-list">
        ${errors
          .slice()
          .reverse()
          .map((e) => {
            const time = new Date(e.timestamp).toLocaleString();
            const detail = escapeHtml(e.detail || "No additional detail");
            return `
            <li class="error-log-item">
              <div class="error-log-header">
                <strong>${escapeHtml(e.source)}</strong>
                <span class="text-muted">${time}</span>
              </div>
              <div>${escapeHtml(e.message)}</div>
              <pre class="error-log-detail">${detail}</pre>
            </li>`;
          })
          .join("")}
      </ul>
      <button id="btn-clear-errors" class="btn">Clear Error Log</button>
    </section>`;

  document.getElementById("btn-clear-errors")?.addEventListener("click", () => {
    clearErrors();
    renderErrorLog();
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
