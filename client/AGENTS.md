# client/

Vanilla TypeScript PWA bundled by Vite 5. No framework (no React/Vue/Svelte).

## Entry Chain

`index.html` → `src/main.ts` (registers service worker, mounts into `#app`) → `src/app.ts` (nav shell + page router).

## Files

| File | Role |
|------|------|
| `src/main.ts` | Bootstrap: imports `styles.css`, registers `sw.js`, calls `renderApp()` |
| `src/app.ts` | App shell with `<nav>` (Book / Settings) and `<main id="page-content">`. In-memory page switching via `currentPage` variable, no URL routing. |
| `src/pages/booking.ts` | Multi-step booking wizard. Steps: waste select → start booking → date select → slot select → confirm. Module state: `sessionId`, `formGuid`, `wasteOptions`, `dates`, `slots`. |
| `src/pages/settings.ts` | Settings form. Loads via `api.getSettings()`, renders `<form>`, saves via `api.saveSettings()` with `FormData`. |
| `src/api.ts` | HTTP client. `request<T>()` wrapper around `fetch()` to `/api/*`. Exports `api` object with typed methods. |
| `src/styles.css` | Single global stylesheet. CSS custom properties on `:root`, plain class names (`.btn`, `.select`, `.step`, etc.). |
| `public/sw.js` | Service worker. Network-first for `/api/` requests; may cache static assets. |
| `public/manifest.json` | PWA manifest for installability. |
| `public/favicon.svg` | App icon. |

## API Client (`src/api.ts`)

Exports `api` with these methods (all return promises):

| Method | HTTP | Path | Body / Query |
|--------|------|------|-------------|
| `startBooking(wasteIds)` | POST | `/booking/start` | `{ wasteIds: string[] }` |
| `submitTrash(sessionId, wasteIds)` | POST | `/booking/trash` | `{ sessionId, wasteIds }` |
| `getSlots(sessionId, date)` | GET | `/booking/slots` | `?sessionId=...&date=...` |
| `confirmBooking(sessionId, slotValue)` | POST | `/booking/confirm` | `{ sessionId, slotValue }` |
| `getSettings()` | GET | `/settings` | — |
| `saveSettings(updates)` | PUT | `/settings` | `Partial<Settings>` |

## Types (defined in `api.ts`)

`Settings`, `SettingsOptions`, `WasteType`, `DateOption`, `SlotOption` — these duplicate the server-side definitions and must be kept in sync manually.

## State Management

No store or reactive system. Each page uses module-level variables (`sessionId`, `settings`, etc.) and reads DOM state directly (`querySelectorAll`, `FormData`).

## Build

- Dev: `npm run dev` → Vite on port 5173, proxies `/api` → `http://localhost:3000` (configured in `vite.config.ts`).
- Build: `npm run build` → outputs to `dist/`, served by Express in production.

## Gotchas

- `booking.ts` escapes HTML via `escapeHtml()` for waste labels, but `settings.ts` interpolates `settings.*` values into `innerHTML` unescaped.
- `cancel` endpoint is not exposed in `api.ts` — only usable via direct HTTP.
- No client-side form validation beyond HTML `type="email"`.
