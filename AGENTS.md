# Repository Guidelines

## Project Structure & Module Organization

This repo contains **CarShareCalc**: a no-build web app for estimating trip prices for car sharing in **Riga** (CarGuru, CityBee, Bolt Drive). The UI says “Riga” but the data model is designed for future city/zone expansion.

- `web/`: no-build web app (mobile/desktop)
  - `web/data/*.tsv`: source-of-truth pricing/vehicles data
- `web/lib/`: pricing engine + TSV parsing + i18n
- `scripts/`: data import utilities + asset generation (e.g., icons)
- `docs/`: spec and notes

## Build, Test, and Development Commands

Common commands (from repo root):

- Install/sync Python deps: `uv sync`
- Run the app locally: `npx --yes serve -l 8000 web` → open `http://localhost:8000/`
- Unit tests (Node, no deps): `npm test`
- Refresh data (CarGuru + CityBee) into `web/data/`: `uv run python scripts/import_vehicles.py` and `uv run python scripts/import_options.py`

## Python Environment (uv only)

- This repo standardizes on `uv` for Python deps and running scripts.
- Use `uv sync` once, then prefix script commands with `uv run ...`.

## Coding Style & Naming Conventions

- Use spaces (not tabs).
- JS/CSS: keep it dependency-light (plain ES modules, no build pipeline unless needed).
- UI text: use `data-i18n*` attributes and add strings to `web/lib/i18n.js` (Latvian + English).
- Python (scripts): `snake_case`; keep scripts small and single-purpose.
- TSV schemas: keep stable IDs/columns (e.g., `provider_id`, `vehicle_id`, `option_id`) and append new columns rather than renaming.

## Collaboration (Agent Workflow)

- Before making non-trivial product/UI changes, clarify requirements with a short “interview” (questions first, code second).
- Keep changes incremental and testable; prefer unit tests for pricing logic in `web/lib/`.

## Data & Updates (Rates)

- Source-of-truth lives in `web/data/*.tsv`.
- Bolt Drive data is often manual (in-app); add new vehicles/options by appending TSV rows.
- The app supports local overrides via “Advanced” (TSV pasted into a dialog; saved to `localStorage`).

## Commit & Pull Request Guidelines

- Keep changes focused (e.g., “add Bolt packages”, “fix rounding”, “update CityBee vehicles”).
- PRs: include a source-of-truth link/screenshot for pricing updates and note which TSV files changed.

## Security & Configuration Tips

- Do not commit secrets. If configuration is added later, prefer `.env` (gitignored) + `.env.example`.
