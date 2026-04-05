# server/

Express 4 backend with Puppeteer 23 for browser automation against the council recycling booking form.

## Entry Point

`src/index.ts` — creates Express app, applies `cors()` + `express.json()`, mounts routers, clears `data/logs/` on startup. In production (`NODE_ENV=production`), serves `client/dist` as static files with SPA fallback.

## Directory Structure

| Directory | Role |
|-----------|------|
| `src/config/` | Environment loading (`env.ts`), settings persistence (`settings.ts`), CSS selectors + option arrays (`selectors.ts`). See `config/AGENTS.md`. |
| `src/puppeteer/` | Browser automation: driver class, step fillers, slots API, debug logging. See `puppeteer/AGENTS.md`. |
| `src/routes/` | Express routers for `/api/booking` and `/api/settings`. See `routes/AGENTS.md`. |

## API Surface

| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/booking/start` | Start session, fill steps 1-4, return dates |
| POST | `/api/booking/trash` | Re-submit waste, fill steps 3-4, return dates |
| GET | `/api/booking/slots` | Get time slots for a date |
| POST | `/api/booking/confirm` | Select slot, submit, close session |
| POST | `/api/booking/cancel` | Close session (unused by client) |
| GET | `/api/settings` | Return settings + option lists |
| PUT | `/api/settings` | Merge partial updates into settings.json |
| GET | `/api/health` | `{ status: "ok", timestamp }` |

## Session Model

`Map<string, BookingDriver>` in `routes/booking.ts`. Each session holds a live Puppeteer browser instance. Sessions are created on `/start`, removed on `/confirm`, `/cancel`, or error. Lost on server restart.

## Data Persistence

- `data/settings.json` — user settings, merged over `.env` defaults at read time.
- `data/logs/` — HTML snapshots and screenshots written on errors or debug. Cleared on startup.

## Build

- Dev: `npm run dev` → `tsx watch src/index.ts` on port 3000.
- Build: `npm run build` → `tsc` → `dist/`.
- TypeScript: `ES2022` target, `NodeNext` modules, `strict`, `sourceMap`, `declaration`.

## External Integration

All automation targets `selfservice.ardsandnorthdown.gov.uk`. The council form is an ASPX multi-step form that uses AJAX POSTs to `/renderform/form` for section navigation. Slots are fetched via direct HTTP POST to `/renderform/getavailabletimeslots` using Puppeteer session cookies.
