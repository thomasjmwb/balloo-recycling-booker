/**
 * Direct HTTP call to getavailabletimeslots (curl-style).
 * Matches the form submission format exactly for correct slot data.
 */

import type { Cookie } from "puppeteer";
import { SLOTS_API_URL } from "../config/env.js";

const ORIGIN = "https://selfservice.ardsandnorthdown.gov.uk";

function formatCookies(cookies: Cookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

function toStartDate(dateValue: string): string {
  if (dateValue.includes("-")) return dateValue;
  return dateValue.replace(/\//g, "-");
}

/**
 * Parses getavailabletimeslots response.
 * Format: JSON object { "value|value|id": "label", ... }
 */
function parseSlotsResponse(body: string): Array<{ value: string; label: string }> {
  const trimmed = body.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed)
        .filter(([key]) => key && typeof key === "string" && key.includes("|") && !key.startsWith("{"))
        .map(([value, label]) => ({
          value: String(value).trim(),
          label: String(label ?? "").trim(),
        }));
    }
    if (Array.isArray(parsed)) {
      return parsed.map((o: { value?: string; label?: string }) => ({
        value: (o.value ?? "").trim(),
        label: (o.label ?? "").trim(),
      }));
    }
  } catch {
    /* fall through */
  }
  return [];
}

export interface FetchSlotsParams {
  formGuid: string;
  dateValue: string;
  cookies: Cookie[];
  fieldId?: number;
}

export async function fetchSlots(params: FetchSlotsParams): Promise<{
  slots: Array<{ value: string; label: string }>;
  ourRequest: { url: string; body: string; headers: Record<string, string> };
}> {
  const { formGuid, dateValue, cookies, fieldId = 8 } = params;
  const startDate = toStartDate(dateValue);
  const body = `startDate=${encodeURIComponent(startDate)}&formGuid=${encodeURIComponent(formGuid)}&fieldId=${fieldId}`;
  const cookieHeader = formatCookies(cookies);
  const referer = `${ORIGIN}/RenderForm?g=${formGuid}&s=4`;

  const headers: Record<string, string> = {
    accept: "text/plain, */*; q=0.01",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/x-www-form-urlencoded",
    cookie: cookieHeader,
    dnt: "1",
    origin: ORIGIN,
    priority: "u=1, i",
    referer,
    "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "x-requested-with": "XMLHttpRequest",
  };

  console.log("[Slots API] POST", SLOTS_API_URL, "startDate=", startDate, "formGuid=", formGuid);

  const curlLines = [
    `curl -X POST "${SLOTS_API_URL}"`,
    `  -H "accept: ${headers.accept}"`,
    `  -H "content-type: ${headers["content-type"]}"`,
    `  -H "cookie: ${headers.cookie}"`,
    `  -H "origin: ${headers.origin}"`,
    `  -H "referer: ${headers.referer}"`,
    `  -H "x-requested-with: ${headers["x-requested-with"]}"`,
    `  -H "user-agent: ${headers["user-agent"]}"`,
    `  --data-raw "${body}"`,
  ];
  console.log("[Slots API] Equivalent curl:\n" + curlLines.join(" \\\n"));

  const res = await fetch(SLOTS_API_URL, { method: "POST", headers, body });
  const text = await res.text();

  console.log("[Slots API] status:", res.status, "body length:", text.length);
  if (text.length <= 500) {
    console.log("[Slots API] body:", text);
  } else {
    console.log("[Slots API] body preview:", text.slice(0, 300), "...");
  }

  if (!res.ok) throw new Error(`Slots API ${res.status}: ${res.statusText}`);

  const slots = parseSlotsResponse(text);
  console.log("[Slots API] parsed", slots.length, "slots");
  if (slots.length > 0) {
    console.log("[Slots API] first 3:", JSON.stringify(slots.slice(0, 3), null, 2));
  }
  return {
    slots,
    ourRequest: {
      url: SLOTS_API_URL,
      body,
      headers: { ...headers, cookie: "(redacted)" },
    },
  };
}
