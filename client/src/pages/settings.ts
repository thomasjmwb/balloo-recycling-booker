import { api, type Settings, type SettingsOptions, type BookingRecord } from "../api.js";

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
    </div>
  `;

  try {
    const result = await api.getSettings();
    settings = result.settings;
    options = result.options;
    renderForm();
  } catch (err) {
    container.innerHTML = `<p class="error">Failed to load settings.</p>`;
  }

  try {
    const { bookings } = await api.getBookingHistory();
    renderBookingHistory(bookings);
  } catch {
    // History is non-critical; silently ignore failures
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
    showMessage("Failed to save settings.", "error");
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
