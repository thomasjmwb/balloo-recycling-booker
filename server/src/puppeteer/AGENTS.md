# server/src/puppeteer/

Browser automation layer. Drives a headless Chrome instance through the council's multi-step ASPX booking form.

## Files

### driver.ts — `BookingDriver` class

Manages a single Puppeteer browser session. One instance per booking session.

**Lifecycle:** `start()` launches Chrome, navigates to `BOOKING_URL`, extracts `formGuid` (tries `#form-guid`, falls back to `input[name="FormGuid"]`). `close()` shuts down browser and nulls all refs.

**State:** `browser`, `page`, `formGuid` (private). Accessors: `getPage()`, `getFormGuid()`, `getFormGuidFromPage()` (re-reads from DOM after each submit), `getCookies()`, `getCurrentSection()`.

**DOM helpers:**
- `type(selector, text)` — types into input (appends)
- `fill(selector, text)` — clears input via `el.value = ...` + dispatches input/change events
- `select(selector, value)` — selects dropdown option + dispatches change event
- `click(selector)` — clicks element
- `setCheckbox(selector, checked)` — toggles checkbox to desired state
- `clickRadio(selector)` — clicks radio button
- `getSelectOptions(selector)` — returns `{ value, label }[]` from `<select>`
- `waitFor(selector, timeout?)`, `exists(selector)` — element queries

**`submitAndWait()`** — clicks `#submit-button`, waits for POST response to URL containing `/renderform/form`, then checks if section advanced. If still on the same section, looks for `.validation-summary-errors` or `.alert-danger` and throws with the error text.

### steps.ts — Form step automation

Each function takes a `BookingDriver` and fills/submits one form section. Screenshots are taken at key points via `logScreenshot`.

| Export | What it does |
|--------|-------------|
| `fillStep1(driver, settings)` | Fills email, blue badge, residential/charity, who brings waste, charity fields (conditional), address lookup (6-phase flow: fill postcode → click search → wait for dropdown → wait for container → select address → verify hidden field), van hire radio. Submits. |
| `fillStep2(driver, wasteIds)` | Unchecks all waste checkboxes, checks only the provided IDs. Submits. |
| `fillStep3(driver, settings)` | Fills vehicle registration, transport type, trailer type, site. Submits. |
| `fillStep4(driver)` | Checks terms checkbox. Submits. |
| `getAvailableDates(driver)` | Reads `<option>` elements from `#FF8_Date`, filters out placeholders. Returns `{ value, label }[]`. |
| `selectDateAndGetSlots(driver, dateValue)` | Selects date in form dropdown, captures the browser's `getavailabletimeslots` request (3s timeout race), then calls `fetchSlots()` via direct HTTP with the session's `formGuid` and cookies. Injects returned slots into the form's `#FF8_Time` select. Writes debug JSON to `data/logs/slots-debug.json`. |
| `selectSlotAndSubmit(driver, slotValue)` | Selects the time slot in `#FF8_Time` and submits the final form. |

Private: `delay(ms)`, `setupFormSlotsCapture(page)` (attaches request/response listeners for `getavailabletimeslots` URL).

### slotsApi.ts — Direct HTTP slot fetching

Bypasses the browser's AJAX to fetch time slots directly, using Puppeteer session cookies for auth.

**`fetchSlots(params: FetchSlotsParams)`** — POST to `SLOTS_API_URL` with `application/x-www-form-urlencoded` body (`startDate`, `formGuid`, `fieldId`). Uses browser-like headers (User-Agent, sec-fetch-*, etc.) and council `ORIGIN` (`https://selfservice.ardsandnorthdown.gov.uk`). Returns `{ slots: { value, label }[], ourRequest }`.

**`parseSlotsResponse(body)`** — Handles JSON format `{ "value|value|id": "label", ... }` (pipe-delimited keys). Also handles array format as fallback.

**`FetchSlotsParams`** — `{ formGuid: string, dateValue: string, cookies: Cookie[], fieldId?: number }`. Default `fieldId` is 8.

Helpers: `formatCookies(cookies)` (joins as `name=value; ...`), `toStartDate(dateValue)` (converts `/` to `-`).

### htmlLogger.ts — Debug logging

Writes to `data/logs/` (created if missing). Files overwrite on each call (no accumulation).

| Export | What it writes |
|--------|---------------|
| `logHtmlSnapshot(page, label, errorMessage?)` | `{label}.html` — full page HTML with metadata comment (timestamp, URL, error). |
| `logScreenshot(page, label)` | `{label}.png` — full-page screenshot. |

`DEBUG_HTML_LOGS` env var is checked but the gating is incomplete — snapshots are always written when the function is called.
