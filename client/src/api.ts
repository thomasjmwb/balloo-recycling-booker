const API_BASE = "/api";

export interface Settings {
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
  wasteDefaults: string[];
  vehicleRegistration: string;
  transportType: string;
  trailerType: string;
  site: string;
}

export interface SettingsOptions {
  wasteTypes: Array<{ id: string; label: string }>;
  transportTypes: string[];
  trailerTypes: string[];
  sites: string[];
  residentialOrCharityOptions: string[];
  whoBringsWasteOptions: string[];
}

export interface WasteType {
  id: string;
  label: string;
  defaultChecked: boolean;
}

export interface DateOption {
  value: string;
  label: string;
}

export interface SlotOption {
  value: string;
  label: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
}

export const api = {
  // Booking
  async startBooking(wasteIds: string[]): Promise<{
    sessionId: string;
    formGuid: string;
    dates: DateOption[];
  }> {
    return request("/booking/start", {
      method: "POST",
      body: JSON.stringify({ wasteIds }),
    });
  },

  async submitTrash(
    sessionId: string,
    wasteIds: string[]
  ): Promise<{
    formGuid: string;
    dates: DateOption[];
  }> {
    return request("/booking/trash", {
      method: "POST",
      body: JSON.stringify({ sessionId, wasteIds }),
    });
  },

  async getSlots(
    sessionId: string,
    date: string
  ): Promise<{
    slots: SlotOption[];
  }> {
    return request(`/booking/slots?sessionId=${sessionId}&date=${encodeURIComponent(date)}`);
  },

  async confirmBooking(sessionId: string, slotValue: string): Promise<{ success: boolean }> {
    return request("/booking/confirm", {
      method: "POST",
      body: JSON.stringify({ sessionId, slotValue }),
    });
  },

  // Settings
  async getSettings(): Promise<{
    settings: Settings;
    options: SettingsOptions;
  }> {
    return request("/settings");
  },

  async saveSettings(updates: Partial<Settings>): Promise<{
    success: boolean;
    settings: Settings;
  }> {
    return request("/settings", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },
};
