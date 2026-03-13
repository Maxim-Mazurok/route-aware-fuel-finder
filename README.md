# Route-Aware Fuel Finder

Route-Aware Fuel Finder is a mobile-first web app for people in New South Wales who want to stop for fuel when it makes sense, not just when a station happens to be nearby.

It ranks fuel stations against the whole trip:

- live NSW fuel prices
- extra detour time
- extra detour distance
- your car's fuel consumption
- how much your own time is worth

The goal is convenience. The app is not trying to train users to chase fuel cycles, wait for price drops, or track historical trends.

## What You Need

- Node.js 22 or newer
- npm
- Docker Desktop
- An NSW Fuel API key and secret from the [NSW API portal](https://api.nsw.gov.au/Product/Index/22)

## Quick Start

1. Install dependencies.

```bash
npm install
```

2. Copy the environment template and add your NSW Fuel API credentials.

```bash
cp .env.example .env
```

3. Download the NSW OpenStreetMap extract used by the local routing container.

```bash
npm run osm:download
```

4. Start local OSRM routing in Docker.

```bash
npm run osm:up
```

5. Start the app.

```bash
npm run dev
```

6. Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

The frontend runs on `4173`. The local API runs on `8787`.

## Environment Variables

These values live in `.env` and should not be committed.

| Variable | Purpose |
| --- | --- |
| `PORT` | Local API port |
| `OSRM_BASE_URL` | Local OSRM endpoint |
| `NOMINATIM_BASE_URL` | Optional local Nominatim endpoint |
| `NOMINATIM_FALLBACK_BASE_URL` | Public OSM fallback geocoder |
| `NOMINATIM_USER_AGENT` | User-Agent sent to geocoding providers |
| `OSM_EXTRACT_URL` | OSM extract used by the Docker scripts |
| `FUEL_API_BASE_URL` | NSW Fuel API base URL |
| `FUEL_API_KEY` | NSW Fuel API key |
| `FUEL_API_SECRET` | NSW Fuel API secret |

## Geocoding And Routing

The default setup is intentionally pragmatic:

- Routing is local via OSRM in Docker.
- Fuel prices come from the live NSW Fuel API.
- Geocoding uses a local Nominatim instance if one is available.
- If local Nominatim is not running, the app falls back to the public OSM Nominatim service.

That fallback keeps setup light. A full local geocoder is still supported, but it is heavy.

### Optional: Full Local Geocoder

If you want both routing and geocoding locally:

```bash
npm run osm:up:full
```

That path needs far more Docker disk than routing alone.

## Running The Tests

```bash
npm test
npm run test:coverage
npm run lint
npm run build
npm run test:e2e
```

The test pyramid is deliberate:

- unit tests cover ranking, fuel maths, and data normalization
- integration tests cover the main React planning flow
- end-to-end tests verify the happy path in a browser

Playwright runs in mock-service mode so the browser tests stay stable and cheap.

## Product Notes

- Settings are stored in local storage.
- The app assumes current location by default, with an optional manual origin override.
- Fuel compatibility is configurable with separate toggles.
- Ranking is based on effective stop cost rather than raw pump price.

## Project Disclaimer

This project was developed with the Codex app using GPT-5.4 as an implementation assistant. Review the code, environment, and credentials before using it outside local development.

## More Context

- Contributor and architecture notes: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Agent context for coding assistants: [AGENTS.md](./AGENTS.md)
