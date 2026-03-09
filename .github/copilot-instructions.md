# Copilot Instructions

Use [AGENTS.md](../AGENTS.md) as the canonical project context.

High-level guidance for this repository:

- Keep the product focused on route-aware fuel-stop decisions in NSW.
- Favor simple, accessible Mantine-based UI changes over bespoke control implementations.
- Preserve provider boundaries so routing, geocoding, and fuel data sources stay swappable.
- Treat ranking logic as domain code and keep it easy to unit test.
- Avoid adding price-history, alerts, or account-driven complexity unless the product direction changes.
