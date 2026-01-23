# Web App

Lightweight, no-build web app to compare trip costs across providers.

## Run locally

From the repo root:

- `uv run python -m http.server 8000`

Then open:

- `http://localhost:8000/web/`

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
