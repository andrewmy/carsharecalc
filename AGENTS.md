# Repository Guidelines

## Project Structure & Module Organization

This repo contains **CarShareCalc**: a no-build web app for estimating trip prices for car sharing in **Riga** (CarGuru, CityBee, Bolt Drive). The UI says “Riga” but the data model is designed for future city/zone expansion.

- `web/`: no-build web app (mobile/desktop)
  - `web/data/*.tsv`: pricing/vehicles data used by the app
- `web/lib/`: pricing engine + TSV parsing + i18n
- `templates/sheets/*.tsv`: source-of-truth TSVs (editable, versioned; exported into `web/data/`)
- `scripts/`: data import/export utilities and XLSX generators
- `docs/`: spec and notes

## Build, Test, and Development Commands

Common commands (from repo root):

- Install/sync Python deps: `uv sync`
- Run the app locally: `uv run python -m http.server 8000` → open `http://localhost:8000/web/`
- Unit tests (Node, no deps): `npm test`
- Refresh data (CarGuru + CityBee): `uv run python scripts/import_vehicles.py` and `uv run python scripts/import_options.py`
- Export TSVs into the web app: `uv run python scripts/export_web_data.py`

## Python Environment (uv only)

- This repo standardizes on `uv` for Python deps and running scripts.
- Use `uv sync` once, then prefix script commands with `uv run ...`.

## Coding Style & Naming Conventions

- Use spaces (not tabs).
- JS/CSS: keep it dependency-light (plain ES modules, no build pipeline unless needed).
- UI text: use `data-i18n*` attributes and add strings to `web/lib/i18n.js` (Latvian + English).
- Python (scripts): `snake_case`; keep scripts small and single-purpose.
- TSV schemas: keep stable IDs/columns (e.g., `provider_id`, `vehicle_id`, `option_id`) and append new columns rather than renaming.

## Data & Updates (Rates)

- Source-of-truth lives in `templates/sheets/*.tsv`; the web app consumes the exported `web/data/*.tsv`.
- Bolt Drive data is often manual (in-app); add new vehicles/options by appending TSV rows.
- The app supports local overrides via “Advanced” (TSV pasted into a dialog; saved to `localStorage`).

## Commit & Pull Request Guidelines

- Keep changes focused (e.g., “add Bolt packages”, “fix rounding”, “update CityBee vehicles”).
- PRs: include a source-of-truth link/screenshot for pricing updates and note which TSV files changed.

## Security & Configuration Tips

- Do not commit secrets. If configuration is added later, prefer `.env` (gitignored) + `.env.example`.
