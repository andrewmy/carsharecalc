# Repository Guidelines

## Project Structure & Module Organization

This repo contains a Google-Sheets-first trip price calculator (Riga) for car sharing providers.

- `docs/`: specifications and notes (start with `docs/trip-price-calculator-spec.md`)
- `templates/sheets/`: TSV templates + setup instructions for the Google Sheet
- `scripts/`: helper scripts (vehicle import, XLSX generation)

## Build, Test, and Development Commands

There is no “app” to run yet; the deliverables are sheet templates and XLSX exports.

Common commands:

- Create a local env (recommended): `python -m venv .venv && . .venv/bin/activate`
- Generate XLSX (Google Sheets-ready): `python scripts/generate_xlsx_template.py --variant auto-night --embed-sheets-formulas`
- Generate XLSX (Excel-safe, no embedded Sheets formulas): `python scripts/generate_xlsx_template.py --variant auto-night`
- Refresh vehicle list (CarGuru + CityBee): `python scripts/import_vehicles.py`

## Python Environment (venv vs uv)

- Default: `python -m venv .venv` (keep `.venv/` gitignored).
- `uv` is optional; use it if you want faster installs, but keep scripts runnable with standard Python.
- See `scripts/README.md` for script dependencies and usage.

## Coding Style & Naming Conventions

- Use spaces (not tabs).
- Python: `snake_case` identifiers; keep scripts small and single-purpose.
- Data templates: keep stable keys (e.g., `provider_id`, `vehicle_id`, `option_id`) and avoid renaming columns.

## Data & Updates (Rates)

- Pricing rows live in `templates/sheets/Options.tsv` (one row = one option: PAYG/PACKAGE/DAILY).
- Vehicles live in `templates/sheets/Vehicles.tsv`:
  - CityBee + CarGuru can be refreshed via `python scripts/import_vehicles.py`
  - Bolt vehicles/packages are added manually as they appear in-app.
- After changing templates, regenerate XLSX outputs so users can upload to Google Sheets.

## Commit & Pull Request Guidelines

- Keep changes focused (e.g., “add Bolt packages”, “fix rounding”, “update CityBee vehicles”).
- PRs: include the source of truth (link/screenshot), and note which templates/XLSX files changed.

## Security & Configuration Tips

- Do not commit secrets. Use `.env` (gitignored) for local configuration.
- Prefer sample config files (e.g., `.env.example`) when introducing new required settings.
