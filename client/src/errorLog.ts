const STORAGE_KEY = "balloo_error_log";
const MAX_ENTRIES = 50;

export interface ErrorEntry {
  timestamp: string;
  source: string;
  message: string;
  detail: string;
}

let entries: ErrorEntry[] = [];

try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) entries = JSON.parse(stored);
} catch {
  // localStorage unavailable or corrupted — start fresh
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // quota exceeded or unavailable — best-effort
  }
}

export function logError(source: string, message: string, err?: unknown): void {
  let detail = "";
  if (err instanceof Error) {
    detail = `${err.name}: ${err.message}`;
    if (err.stack) detail += `\n${err.stack}`;
  } else if (err !== undefined) {
    detail = String(err);
  }

  const entry: ErrorEntry = {
    timestamp: new Date().toISOString(),
    source,
    message,
    detail,
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  persist();

  console.error(`[${source}] ${message}`, err);
}

export function getErrors(): ErrorEntry[] {
  return [...entries];
}

export function clearErrors(): void {
  entries = [];
  persist();
}
