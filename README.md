# Balloo Recycling Booker

Headless browser automation for booking recycling appointments on an ASPX web form.

## Stack

- **TypeScript**
- **Puppeteer** – headless Chrome automation
- **dotenv** – environment variables from `.env` for local development

## Setup

```bash
npm install
npx puppeteer browsers install chrome
cp .env.example .env
```

Edit `.env` with your values:

| Variable     | Description                              |
| ------------ | ---------------------------------------- |
| `BOOKING_URL` | Base URL for the recycling booking site |
| `FORM_PARAMS` | JSON object of form field names → values |
| `HEADLESS`    | `true` (default) or `false` to show browser |

### Example `.env`

```
BOOKING_URL=https://recycling.example.com/booking.aspx
FORM_PARAMS={"txtPostcode":"SW1A 1AA","ddlArea":"Central"}
HEADLESS=true
```

## Scripts

| Command      | Description                    |
| ------------ | ------------------------------ |
| `npm run dev` | Run with tsx (no build step)   |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start`  | Run compiled output            |
| `npm run lint` | Run ESLint                    |
| `npm run format` | Format with Prettier         |

## Project structure

```
src/
  config/env.ts   # Environment config (loads .env, validates vars)
  main.ts         # Entry point, Puppeteer setup
```

Form interaction logic will be added in `main.ts` once the ASPX form structure is known.

## Docker

Build the image (includes Chrome and all dependencies):

```bash
docker build -t balloo-recycling-booker .
```

Run the container with your env variables:

```bash
docker run --rm \
  -e BOOKING_URL="https://recycling.example.com/booking.aspx" \
  -e FORM_PARAMS='{"txtPostcode":"SW1A 1AA"}' \
  -e HEADLESS=true \
  balloo-recycling-booker
```

Or use an env file:

```bash
docker run --rm --env-file .env balloo-recycling-booker
```

The Docker image is self-contained — no need to install Chrome or system libraries on the host.
