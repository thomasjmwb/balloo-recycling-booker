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
- **Prod:** `npm run build` compiles both; `npm start` runs Express which serves `client/dist` as static files with SPA fallback. On the production machine the app runs as the NSSM service `recycling-booker` on port **3100** (the `PORT` in `.env` is overridden by NSSM `AppEnvironmentExtra`), with Caddy reverse-proxying `https://recycling.local.home` to it. See [docs/deployment.md](docs/deployment.md).
- **Docker:** Multi-stage build (Node 22 slim + Chrome deps). `docker build -t recycling-booker . && docker run -p 3000:3000 --env-file .env recycling-booker`

## Production / Deployment

For anything related to the running production service on this machine — service topology, NSSM and Caddy configuration, access URLs, redeployment, log locations, and debugging recipes — read [docs/deployment.md](docs/deployment.md) **before making changes or diagnosing issues**.

For DNS issues with `recycling.local.home` (typically after a router reboot), see [docs/router-dns-setup.md](docs/router-dns-setup.md).

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

### Where to Find Logs (development)

- Stdout in the terminal running `npm run dev`
- `data/logs/requests.log` — HTTP request log (append-only, reset on server restart since `data/logs/` is cleared on startup)
- `data/logs/*.html` / `*.png` — Puppeteer HTML snapshots and screenshots on errors
- `data/logs/slots-debug.json` — slot API debug data

For production log locations and PowerShell parsing recipes, see [docs/deployment.md](docs/deployment.md#debugging).

### Other Debug Artifacts

- **HTML snapshots** (`error-*.html`): Full page HTML captured on Puppeteer errors, with metadata comment (timestamp, URL, error message).
- **Screenshots** (`error-*.png`, `confirmation.png`): Full-page screenshots at error points and on successful booking confirmation.
- **Slots debug** (`slots-debug.json`): Raw slot API request/response data written on each date selection.

## Gotchas

- `Settings` interface is duplicated in `server/src/config/settings.ts` and `client/src/api.ts` — keep in sync manually.
- `ADDRESS_LOOKUP_URL` and `REFRESH_API_URL` are exported from `server/src/config/env.ts` but unused.
- `POST /api/booking/cancel` exists on the server but the client never calls it.
- Settings form in `client/src/pages/settings.ts` interpolates values into `innerHTML` without escaping.
