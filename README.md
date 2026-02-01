# Balloo Recycling Booker

A PWA for quickly booking recycling centre appointments. Automates most form fields so you only need to select waste types and pick a time slot.

## Features

- **PWA**: Install on your phone for quick access
- **Automation**: Pre-fills form with saved settings
- **Waste Selection**: Pick what you're bringing each visit
- **Time Booking**: See available slots and book instantly
- **Settings**: Configure your details once, use forever

## Project Structure

```
├── client/           # PWA frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── app.ts           # Main app + routing
│   │   ├── pages/           # Booking and Settings pages
│   │   └── api.ts           # API client
│   └── public/              # Static assets
├── server/           # Backend (Express + Puppeteer)
│   └── src/
│       ├── config/          # Environment, settings, selectors
│       ├── puppeteer/       # Browser driver and step automation
│       └── routes/          # API endpoints
├── scripts/          # Development utilities
│   ├── discover.ts          # Form inspection tool
│   └── test-steps.ts        # Step-by-step testing
└── data/             # Runtime data (settings, screenshots)
```

## Quick Start

### Prerequisites

- Node.js 22+
- Chrome/Chromium (Puppeteer will install it)

### Setup

```bash
# Install all dependencies
npm run install:all

# Copy and configure environment
cp .env.example .env
# Edit .env with your details

# Start development (client + server)
npm run dev
```

Open http://localhost:5173 in your browser.

### See the browser / screenshots

- **Watch the browser**: Set `HEADLESS=false` in `.env` to see the Chrome window as it fills the form.
- **Screenshots on errors**: When a step fails, HTML and screenshots are saved to `data/logs/`:
  - `error-form-guid.html` / `error-form-guid.png` — formGuid lookup failed
  - `error-step2-trash.html` / `error-step2-trash.png` — waste submission failed
- **Enable HTML logs**: Set `DEBUG_HTML_LOGS=true` in `.env` (already on by default).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both client and server in dev mode |
| `npm run dev:server` | Start only the backend server |
| `npm run dev:client` | Start only the frontend |
| `npm run build` | Build both for production |
| `npm start` | Run production server |
| `npm run discover` | Run form discovery script |
| `npm run test:step` | Test individual form steps |

## Configuration

Settings can be configured two ways:

1. **Environment variables** (`.env` file) - defaults
2. **Settings page** in the PWA - overrides

The PWA settings page lets you update:
- Email and contact info
- Vehicle registration
- Default waste types
- Preferred site

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   PWA UI     │────▶│   Express    │────▶│  Puppeteer   │
│  (Vite)      │     │   Server     │     │  (Chrome)    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  Settings    │     │  Council     │
                     │  (JSON)      │     │  Website     │
                     └──────────────┘     └──────────────┘
```

1. **Start Booking**: Server launches browser, navigates to form
2. **Fill Details**: Puppeteer fills Step 1 (your details) from settings
3. **Select Waste**: PWA shows checkboxes, you pick what you're bringing
4. **Continue**: Server fills Steps 2-4 (vehicle, terms)
5. **Pick Time**: PWA shows available dates/times
6. **Confirm**: Server completes booking

## Docker

```bash
# Build image
docker build -t recycling-booker .

# Run with your config
docker run -p 3000:3000 --env-file .env recycling-booker
```

## Development

### Discovery Script

Inspect the form structure and find selectors:

```bash
npm run discover
```

This opens a browser and walks through the form, logging field IDs and options.

### Step Testing

Test individual form steps:

```bash
npm run test:step -- 1  # Test step 1 (Your details)
npm run test:step -- 2  # Test step 2 (Your waste)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/booking/start` | Start new booking session |
| `POST` | `/api/booking/trash` | Submit waste selection |
| `GET` | `/api/booking/slots` | Get time slots for date |
| `POST` | `/api/booking/confirm` | Confirm booking |
| `GET` | `/api/settings` | Get current settings |
| `PUT` | `/api/settings` | Update settings |

## License

ISC
