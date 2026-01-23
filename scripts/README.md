# Scripts

This repo standardizes on `uv`.

Install/sync deps:

- `uv sync`

## `generate_xlsx_template.py`

Generates `carcalc-template.xlsx` (an importable starter workbook for Google Sheets).

Run:

- `uv run python scripts/generate_xlsx_template.py`

Notes:

- The workbook embeds Google Sheets formulas (e.g., `ARRAYFORMULA`). Excel will not evaluate them, but Google Sheets will after upload.
- Night-minute calculation still requires adding the Apps Script function from `templates/sheets/apps_script.gs` (see `templates/sheets/SETUP.md`).

## `import_vehicles.py`

Refreshes `templates/sheets/Vehicles.tsv` from public sources (CarGuru + CityBee).

- `uv run python scripts/import_vehicles.py`

## `import_options.py`

Refreshes `templates/sheets/Options.tsv` from public sources (CarGuru + CityBee) and keeps Bolt rows as-is.

- `uv run python scripts/import_options.py`

## `export_web_data.py`

Copies the TSV templates into `web/data/` for the web app to load.

- `uv run python scripts/export_web_data.py`

## `generate_favicon.py`

Generates app icons in `web/` (favicon + PWA/mobile PNGs).

- `uv run python scripts/generate_favicon.py path/to/source.png`

Notes:

- Accepts 8-bit RGB or RGBA PNG.
- If the source is not square, it will be center-cropped to a square before resizing.
