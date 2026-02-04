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

## `carguru_tools.py`

Small helper for fetching/inspecting CarGuru public web API payloads (useful for debugging tariff semantics like “Prepaid 24h”).

- Fetch `rate/short` JSON:
  - `uv run python scripts/carguru_tools.py fetch-rate-short`
- Print a Prepaid 24h table from saved JSON:
  - `uv run python scripts/carguru_tools.py report-prepaid-24h`
- Fetch + print a decoded article (e.g., id 476):
  - `uv run python scripts/carguru_tools.py fetch-article --id 476 --print-plain`

## `snowboard_queue.py`

Prints a PR-ready checklist of vehicles where `snowboard_fit` is blank in `web/data/vehicles.tsv`.

- `uv run python scripts/snowboard_queue.py`

## `consumption_queue.py`

Prints a PR-ready checklist of vehicles missing `fuel_type` and/or `consumption_l_per_100km_default` in `web/data/vehicles.tsv`.

- `uv run python scripts/consumption_queue.py`

## `fill_consumption.py`

Semi-automated helper that fills `fuel_type` and `consumption_l_per_100km_default` from known sources.
Currently supports Carwow model pages by converting their displayed MPG range (uses worst-case / least efficient end to avoid underestimating). The app applies an additional hardcoded Riga multiplier (×1.15) at runtime.

- Dry-run:
  - `uv run python scripts/fill_consumption.py`
- Apply to `web/data/vehicles.tsv`:
  - `uv run python scripts/fill_consumption.py --apply`

## `bolt_clone_tier.py`

Clones all **Bolt** `web/data/options.tsv` rows from a tier representative vehicle to a new Bolt vehicle_id.
This avoids re-entering dozens of package rows when multiple cars share the same tier.

- Dry-run (prints TSV snippets to paste):
  - `uv run python scripts/bolt_clone_tier.py --from-vehicle-id bolt_vw_tayron --to-vehicle-id bolt_vw_id4 --to-vehicle-name "VW ID.4" --snowboard-fit 2`
- Apply directly to TSVs:
  - `uv run python scripts/bolt_clone_tier.py --apply --from-vehicle-id bolt_vw_tayron --to-vehicle-id bolt_vw_id4 --to-vehicle-name "VW ID.4" --snowboard-fit 2 --as-of 2026-01-24`

Common overrides (if the new car’s PAYG differs from the representative):

- `--minute-rate 0.15` (applies to all cloned rows)
- `--km-rate 0.30` (applies to all cloned rows)
- `--min-total 2.75` / `--cap-24h 27.90` (PAYG only)
- `--airport-fee 3.5`

## `generate_favicon.py`

Generates app icons in `web/` (favicon + PWA/mobile PNGs).

- `uv run python scripts/generate_favicon.py path/to/source.png`

Notes:

- Accepts 8-bit RGB or RGBA PNG.
- If the source is not square, it will be center-cropped to a square before resizing.
