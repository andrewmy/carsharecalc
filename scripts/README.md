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

Prints a PR-ready checklist of vehicles where `snowboard_fit` is blank in `web/data/vehicles.tsv`.

- `uv run python scripts/snowboard_queue.py`

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
