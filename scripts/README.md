# Scripts

This repo standardizes on `uv`.

Install/sync deps:

- `uv sync`

## `import_vehicles.py`

Refreshes `web/data/vehicles.tsv` from public sources (CarGuru + CityBee).

- `uv run python scripts/import_vehicles.py`

## `import_options.py`

Refreshes `web/data/options.tsv` from public sources (CarGuru + CityBee) and keeps non-CarGuru/CityBee rows (e.g., Bolt) as-is.

- `uv run python scripts/import_options.py`

## `snowboard_queue.py`

Prints a PR-ready checklist of vehicles where `snowboard_ok` is blank in `web/data/vehicles.tsv`.

- `uv run python scripts/snowboard_queue.py`

## `generate_favicon.py`

Generates app icons in `web/` (favicon + PWA/mobile PNGs).

- `uv run python scripts/generate_favicon.py path/to/source.png`

Notes:

- Accepts 8-bit RGB or RGBA PNG.
- If the source is not square, it will be center-cropped to a square before resizing.
