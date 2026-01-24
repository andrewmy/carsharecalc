# Web App

Lightweight, no-build web app to compare trip costs across providers.

## Run locally

From the repo root:

- `npx --yes serve -l 8000 web`

Then open:

- `http://localhost:8000/`

## Data

The app loads TSV data from `web/data/`:

- `web/data/providers.tsv`
- `web/data/vehicles.tsv`
- `web/data/options.tsv`

Update data:

- Edit the TSVs directly (commit changes), or
- Pull the latest CarGuru/CityBee lists into `web/data/`:
  - `uv run python scripts/import_vehicles.py`
  - `uv run python scripts/import_options.py`

Vehicle metadata columns are append-only; see `docs/trip-price-calculator-spec.md` for schema.
Fuel-related fields live in `web/data/vehicles.tsv` (`fuel_type`, `consumption_l_per_100km_default`, `consumption_source_url`).
