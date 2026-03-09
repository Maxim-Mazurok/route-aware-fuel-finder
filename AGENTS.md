# Agent Context

## Project Overview

Route-Aware Fuel Finder is a mobile-first NSW web app that helps a driver decide whether a fuel stop is worth it on the way to a destination.

The product is built around convenience, not fuel-price obsession. The app should adapt to the trip the user is already taking instead of trying to change their habits.

## What The App Optimizes

The app ranks stations using a trade-off between:

- fuel price
- detour distance
- detour time
- vehicle consumption
- current fuel on hand
- the user's value of time

The output should feel practical and transparent. Raw pump price alone is not the ranking model.

## Current Technical Shape

- React + TypeScript frontend
- Mantine UI for accessible, consistent controls
- Leaflet for the simple route-and-stations map
- Express API for local development and future hosted parity
- NSW Fuel API for live prices and station metadata
- OSRM for routing and detour measurements
- Nominatim for geocoding, with local-first and public fallback behavior

## Architectural Intent

Keep business logic separate from service wiring.

- `src/domain` contains ranking, fill, and distance logic
- `src/providers` adapts the frontend to concrete services
- `server/lib` wraps live providers and normalizes upstream responses

Provider interfaces are important. They make it possible to replace routing or geocoding later without rewriting the ranking or UI flow.

## Product Boundaries

Stay aligned with the current product direction:

- personal-first, but public-capable later
- zero recurring cost where practical
- no price-history feature creep in the core flow
- no alerts, nudges, or guilt-driven UX
- saved settings in local storage
- current location by default, manual origin optional

## UI Direction

The UI should stay functional, accessible, and mobile-first.

- Prefer consistency over visual novelty.
- Use the design system instead of inventing ad hoc controls.
- Keep copy short and direct.
- Make units explicit in all numeric inputs.
- Avoid arbitrary limits unless they are genuinely required by the domain.

## Testing Expectations

Maintain the testing pyramid:

- unit tests for domain rules and data normalization
- integration tests for the main app behavior
- a small number of end-to-end tests for important user journeys

When possible, push logic into testable pure functions instead of burying it inside UI components.
