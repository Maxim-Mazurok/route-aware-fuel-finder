# Contributing

This repository is a personal-first project, but it is structured so it can grow into a public app later without being rewritten from scratch.

## Product Intent

Route-Aware Fuel Finder is not a general trip planner and not a fuel-price tracking tool.

It exists to answer one practical question:

> Given where I am, where I am going, how much fuel I have, and what my time is worth, which fuel stops are actually worth considering right now?

The product should stay biased toward convenience:

- no price-history features in the core flow
- no nagging alerts or gamified savings pressure
- no unnecessary setup before the app becomes useful

## Current Stack

### Frontend

- React 19
- TypeScript
- Vite
- Mantine UI for accessible, consistent form and layout primitives
- Leaflet for the lightweight route and station map

### Backend

- Express
- TypeScript
- NSW Fuel API for live station prices and locations
- OSRM for local route planning and detour measurements
- Nominatim for geocoding, with local-first and public fallback support

### Testing

- Vitest for unit and integration tests
- Testing Library for React flow coverage
- Playwright for browser happy-path verification

## Architecture Notes

The important boundary in this codebase is not frontend versus backend. It is domain logic versus provider wiring.

### Domain

Files in `src/domain` should stay mostly pure. Ranking, fill calculations, fuel compatibility, distance maths, and formatting rules belong there because they are core product behavior, not infrastructure details.

### Providers

Files in `src/providers` adapt the app to live services:

- `FuelPriceProvider`
- `GeocodingProvider`
- `RouteProvider`
- `CurrentLocationProvider`

Keep these abstractions stable. If the project later moves from public Nominatim to something else, or from local OSRM to another routing backend, the app should not need a redesign.

### API Layer

The local API exists to:

- protect credentials from the browser
- normalize third-party responses
- centralize error handling
- make local and future hosted deployments look the same to the frontend

## Data Flow

1. The frontend loads the current station dataset from the local API.
2. The user sets destination, vehicle details, allowed fuels, and ranking preferences.
3. The app resolves origin and destination.
4. The route provider gets the base route and measures plausible station detours.
5. The ranking engine computes effective stop cost and sorts the list.
6. The UI renders the ranked list and the route map.

## Practical Constraints

- Zero recurring cost is a core constraint for now.
- Settings live in local storage; there is no account system.
- Local routing should stay easy to start with Docker.
- Local geocoding is optional because full Nominatim imports are disk-heavy.

## Code Style Expectations

- Prefer simple data shapes and straightforward functions.
- Do not add extra abstractions unless a second real use-case exists.
- Keep UI state readable; avoid clever indirection for forms.
- Maintain the provider interfaces so live integrations remain swappable.
- Preserve accessibility and mobile usability when touching the UI.

## Testing Guidance

Keep the testing pyramid intact:

- unit tests for fuel maths, ranking, and normalization
- integration tests for the React planning flow and persistence behavior
- a few e2e tests for the most important user journeys

Do not push logic into UI components if it makes the core ranking rules harder to test directly.

## Local Development Notes

- `npm run dev` starts the frontend and API together.
- `npm run osm:download` pulls the Sydney extract used for routing.
- `npm run osm:up` is the normal local-routing path.
- `npm run osm:up:full` is optional and much heavier because it includes local geocoding.

## Before Opening A Pull Request

Run:

```bash
npm test
npm run test:coverage
npm run lint
npm run build
npm run test:e2e
```

If you change live integrations or environment handling, also confirm that `.env` is still ignored and that no secrets appear in staged changes.
