import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../../data");
const BOOKINGS_PATH = join(DATA_DIR, "bookings.json");

export interface BookingRecord {
  id: string;
  dateLabel: string;
  slotLabel: string;
  confirmedAt: string;
}

export function loadBookings(): BookingRecord[] {
  if (!existsSync(BOOKINGS_PATH)) {
    return [];
  }

  try {
    const raw = readFileSync(BOOKINGS_PATH, "utf-8");
    return JSON.parse(raw) as BookingRecord[];
  } catch {
    console.warn("Failed to read bookings.json, returning empty list");
    return [];
  }
}

export function addBooking(record: BookingRecord): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  const bookings = loadBookings();
  bookings.push(record);
  writeFileSync(BOOKINGS_PATH, JSON.stringify(bookings, null, 2), "utf-8");
}
