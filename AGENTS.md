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

## Gotchas

- `Settings` interface is duplicated in `server/src/config/settings.ts` and `client/src/api.ts` — keep in sync manually.
- `ADDRESS_LOOKUP_URL` and `REFRESH_API_URL` are exported from `server/src/config/env.ts` but unused.
- `POST /api/booking/cancel` exists on the server but the client never calls it.
- Settings form in `client/src/pages/settings.ts` interpolates values into `innerHTML` without escaping.
