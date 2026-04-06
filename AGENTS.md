# Balloo Recycling Booker

PWA that automates booking recycling centre appointments on the Ards and North Down council self-service site.

## Architecture

```
PWA (Vite, vanilla TS) --fetch /api/*--> Express (Node) --Puppeteer--> Council website
                                             |
                                        data/settings.json
```

- **client/** — Vite 5 PWA, vanilla TypeScript, no framework. Two pages: booking wizard + settings form.
- **server/** — Express 4 + Puppeteer 23. REST API that drives a headless Chrome session against the council booking form.
- **scripts/** — Dev utilities run via `tsx`: `discover.ts` (form inspector), `test-steps.ts` (selector smoke tests), `debug-slots-capture.ts` (network capture).
- **data/** — Runtime directory (gitignored). Contains `settings.json` and `logs/` (HTML snapshots, screenshots on errors).

## Data Model

- **No database.** Settings persist in `data/settings.json`, merged over `.env` defaults at read time.
- **Sessions** are an in-memory `Map<string, BookingDriver>` in `server/src/routes/booking.ts`. Lost on restart.
- **No auth.** CORS is open. The app is designed for trusted/local use.

## Environment

`BOOKING_URL` is the only required env var (deep link to the council form). All others are optional with defaults defined in `server/src/config/env.ts`. Copy `.env.example` to `.env` to configure.

## Dev / Prod

- **Dev:** `npm run dev` starts Vite on :5173 (proxies `/api` to :3000) and Express on :3000 concurrently.
- **Prod:** `npm run build` compiles both; `npm start` runs Express which serves `client/dist` as static files with SPA fallback.
- **Docker:** Multi-stage build (Node 22 slim + Chrome deps). `docker build -t recycling-booker . && docker run -p 3000:3000 --env-file .env recycling-booker`

## Key Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Client + server in watch mode |
| `npm run build` | Production build (both) |
| `npm start` | Run production server |
| `npm run discover` | Interactive form structure inspector |
| `npm run test:step -- <n>` | Smoke-test selectors for step n (1-5) |

## TypeScript

Solution-style `tsconfig.json` references `./server` and `./client`. Server uses `NodeNext` modules; client uses `bundler` resolution with `noEmit` (Vite handles emit).

## Logging

All HTTP requests are logged as single-line JSON to stdout and (by default) to `data/logs/requests.log`.

### Log Format

```json
{"ts":"2026-04-05T12:00:00.000Z","method":"POST","url":"/api/booking/start","status":200,"ms":4523,"size":142}
```

| Field | Description |
|-------|-------------|
| `ts` | ISO 8601 timestamp |
| `method` | HTTP method (GET, POST, PUT) |
| `url` | Request path including query string |
| `status` | HTTP response status code |
| `ms` | Response time in milliseconds |
| `size` | Response Content-Length in bytes (0 if not set) |

### Environment Variables

| Var | Default | Effect |
|-----|---------|--------|
| `LOG_REQUESTS` | `true` | Write request logs to `data/logs/requests.log` in addition to stdout |
| `DEBUG_HTML_LOGS` | `true` | Enable Puppeteer HTML snapshot logging (read directly by `htmlLogger.ts`) |

### Where to Find Logs

**Local development (working directory):**

- Stdout in the terminal running `npm run dev`
- `data/logs/requests.log` — HTTP request log (append-only, reset on server restart since `data/logs/` is cleared on startup)
- `data/logs/*.html` / `*.png` — Puppeteer HTML snapshots and screenshots on errors
- `data/logs/slots-debug.json` — slot API debug data

**Production (`C:\services\recycling-booker`):**

The NSSM service (`recycling-booker`) redirects stdout/stderr to files. Check these paths on the production machine:

- `C:\services\recycling-booker\data\service-stdout.log` — all `console.log` output including JSON request logs (rotated at 1 MB by NSSM)
- `C:\services\recycling-booker\data\service-stderr.log` — all `console.error` output (rotated at 1 MB)
- `C:\services\recycling-booker\data\logs\requests.log` — dedicated request log file
- `C:\services\recycling-booker\data\logs\` — HTML snapshots, screenshots, `slots-debug.json`

### Parsing Logs (PowerShell)

Tail the production log live:

```powershell
Get-Content -Wait C:\services\recycling-booker\data\service-stdout.log
```

Filter for errors (status >= 400):

```powershell
Get-Content C:\services\recycling-booker\data\service-stdout.log |
  Where-Object { $_ -match '^\{' } |
  ConvertFrom-Json |
  Where-Object { $_.status -ge 400 }
```

Find slow requests (> 5 seconds):

```powershell
Get-Content C:\services\recycling-booker\data\logs\requests.log |
  ConvertFrom-Json |
  Where-Object { $_.ms -gt 5000 } |
  Format-Table ts, method, url, ms
```

Filter by endpoint:

```powershell
Get-Content C:\services\recycling-booker\data\logs\requests.log |
  ConvertFrom-Json |
  Where-Object { $_.url -like '*/booking/*' } |
  Format-Table ts, method, url, status, ms
```

### Other Debug Artifacts

- **HTML snapshots** (`error-*.html`): Full page HTML captured on Puppeteer errors, with metadata comment (timestamp, URL, error message).
- **Screenshots** (`error-*.png`, `confirmation.png`): Full-page screenshots at error points and on successful booking confirmation.
- **Slots debug** (`slots-debug.json`): Raw slot API request/response data written on each date selection.

## Gotchas

- `Settings` interface is duplicated in `server/src/config/settings.ts` and `client/src/api.ts` — keep in sync manually.
- `ADDRESS_LOOKUP_URL` and `REFRESH_API_URL` are exported from `server/src/config/env.ts` but unused.
- `POST /api/booking/cancel` exists on the server but the client never calls it.
- Settings form in `client/src/pages/settings.ts` interpolates values into `innerHTML` without escaping.
