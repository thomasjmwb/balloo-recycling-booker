# server/src/routes/

Express routers for the REST API. Mounted in `../index.ts` at `/api/booking` and `/api/settings`.

## Files

| File | Router | Endpoints |
|------|--------|-----------|
| `booking.ts` | `bookingRouter` | 5 endpoints for session lifecycle |
| `settings.ts` | `settingsRouter` | 2 endpoints for settings CRUD |

## booking.ts

Manages `sessions: Map<string, BookingDriver>` (in-memory, not shared across processes).

### POST /api/booking/start

- **Body:** `{ wasteIds: string[] }` (at least one required)
- **Flow:** Creates `BookingDriver`, calls `driver.start()`, fills steps 1-4 via Puppeteer, gets available dates from step 5.
- **Response:** `{ sessionId: string, formGuid: string, dates: { value, label }[] }`
- **On error:** Captures HTML snapshot + screenshot, closes driver, returns 500.

### POST /api/booking/trash

- **Body:** `{ sessionId: string, wasteIds: string[] }`
- **Flow:** Looks up session, re-fills step 2 (waste) + steps 3-4, gets dates.
- **Response:** `{ step: "booking", formGuid: string, dates: { value, label }[] }`
- **On error:** Closes driver, deletes session, returns 500.

### GET /api/booking/slots

- **Query:** `sessionId`, `date`
- **Flow:** Calls `selectDateAndGetSlots()` which selects the date in the browser form and fetches slots via direct HTTP.
- **Response:** `{ slots: { value, label }[] }`

### POST /api/booking/confirm

- **Body:** `{ sessionId: string, slotValue: string }`
- **Flow:** Selects slot, submits form, takes confirmation screenshot, closes driver, deletes session.
- **Response:** `{ success: true, message: "Booking confirmed!" }`

### POST /api/booking/cancel

- **Body:** `{ sessionId: string }`
- **Flow:** Closes driver if session exists, deletes session. Always succeeds.
- **Response:** `{ success: true }`
- **Note:** Not called by the client PWA.

## settings.ts

### GET /api/settings

- **Response:** `{ settings: Settings, options: { wasteTypes, transportTypes, trailerTypes, sites, residentialOrCharityOptions, whoBringsWasteOptions } }`
- Settings come from `getSettingsForClient()` (unmasked). Options come from `selectors.ts` arrays plus inline `residentialOrCharityOptions` and `whoBringsWasteOptions` defined in this file.

### PUT /api/settings

- **Body:** `Partial<Settings>`
- **Flow:** Calls `saveSettings(updates)` which merges into existing `data/settings.json`, then reloads and returns.
- **Response:** `{ success: true, settings: Settings }`

## Request Logger Middleware

Defined in `../app.ts`, applied globally before route handlers. Logs every HTTP request as a single-line JSON object to stdout and optionally to `data/logs/requests.log` (controlled by `LOG_REQUESTS` env var, default `true`).

Log fields: `ts` (ISO timestamp), `method`, `url`, `status`, `ms` (response time), `size` (Content-Length).

In production, stdout goes to `C:\services\recycling-booker\data\service-stdout.log` via NSSM. The dedicated `requests.log` file is also available at `C:\services\recycling-booker\data\logs\requests.log`.

## Dependencies

- `booking.ts` imports from `../puppeteer/driver.js`, `../puppeteer/steps.js`, `../puppeteer/htmlLogger.js`, `../config/settings.js`.
- `settings.ts` imports from `../config/settings.js`, `../config/selectors.js`.
