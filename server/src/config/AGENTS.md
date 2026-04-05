# server/src/config/

Configuration layer: environment variables, user settings persistence, and CSS selectors / option arrays for the council form.

## Files

### env.ts

Loads `.env` via `dotenv`, trying three candidate paths (project root, `cwd`, server dir). Throws if no `.env` file exists.

**Exports:**

| Export | Type | Required | Notes |
|--------|------|----------|-------|
| `BOOKING_URL` | string | Yes | Deep link to council booking form |
| `ADDRESS_LOOKUP_URL` | string | No | Default: `selfservice.ardsandnorthdown.gov.uk/core/addresslookup`. **Unused in codebase.** |
| `SLOTS_API_URL` | string | No | Default: `.../renderform/getavailabletimeslots`. Used by `puppeteer/slotsApi.ts`. |
| `REFRESH_API_URL` | string | No | Default: `.../ajax/refresh`. **Unused in codebase.** |
| `PORT` | number | No | Default: 3000 |
| `HEADLESS` | boolean | No | Default: true. Controls Puppeteer headless mode. |
| `EMAIL`, `POSTCODE`, `ADDRESS_VALUE`, ... | string | No | Form field defaults for steps 1 and 3. |
| `WASTE_DEFAULTS` | string[] | No | Comma-separated field IDs, default: `"FF34,FF48,FF33,FF50"`. |

Helper functions `requireEnv`, `optionalEnv`, `optionalBool` are private to this module.

### settings.ts

Persists user settings in `data/settings.json`, merged over environment defaults.

**`Settings` interface** — fields for step 1 (email, address, blue badge, residential/charity, who brings waste, charity fields, commercial provider, van hire), step 2 (wasteDefaults: string[]), step 3 (vehicle registration, transport type, trailer type, site).

**Exports:**

| Function | Signature | Behavior |
|----------|-----------|----------|
| `loadSettings()` | `() => Settings` | Reads `data/settings.json`, merges over `getDefaults()` (from env). Returns defaults if file missing. |
| `saveSettings(updates)` | `(Partial<Settings>) => void` | Loads current, merges updates, writes JSON. Creates `data/` dir if needed. |
| `getSettingsForClient()` | `() => Settings` | Returns `loadSettings()` unmasked (no field redaction). |

Path: `data/settings.json` resolved as `join(__dirname, "../../../data", "settings.json")` relative to compiled output.

### selectors.ts

CSS selectors and option arrays for the council ASPX form. All exported as `as const`.

**`selectors`** — nested object keyed by form area:
- `form`: `formGuid`, `formGuidFallback`, `requestVerificationToken`, `currentSectionId`, `submitButton`, `backButton`, `startAgainButton`
- `sections`: `current`, `future` (sidebar navigation)
- `step1`: email, blue badge, residential/charity, who brings waste, charity fields, address lookup (postcode input, search btn, address list, hidden field, display, change btn), commercial provider fields, van hire radios
- `step2`: 27 waste type checkboxes by field ID (e.g., `bicycles: "#FF135"`, `blueBinRecyclable: "#FF34"`)
- `step3`: vehicle registration, transport type, trailer type, site
- `step4`: terms checkbox
- `step5`: date select, time select

**`wasteTypes`** — array of `{ id: string, label: string, defaultChecked?: true }` (27 items). IDs match checkbox selectors (e.g., `"FF34"`).

**`transportTypes`** — 12 vehicle types (Car, 4x4, Panel van, etc.).

**`trailerTypes`** — 3 options (No Trailer, Single Axle, Double Axle).

**`sites`** — 9 recycling centres (Balloo, Comber, Newtownards, etc.).
