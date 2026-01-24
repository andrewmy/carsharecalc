# Bolt Drive data entry (Riga)

Bolt Drive vehicle lists and pricing are maintained manually (in-app), and committed into the repo TSVs.

This guide describes the recommended, repeatable workflow for adding a new Bolt car (and its rates) without breaking imports for other providers.

## Files you will edit

- `web/data/vehicles.tsv` (vehicle list + metadata)
- `web/data/options.tsv` (pricing options)

Notes:

- `scripts/import_vehicles.py` and `scripts/import_options.py` only regenerate **CityBee** and **CarGuru** rows. They keep other providers (including Bolt) as-is.
- Snowboard metadata lives in `web/data/vehicles.tsv` and is preserved on refresh.

## Step-by-step: add a new Bolt vehicle

1) Pick an ID

- `provider_id`: `bolt`
- `vehicle_id`: use a stable slug, e.g. `bolt_model_3` or `bolt_yaris_cross`
  - Keep it stable across time (don’t include temporary marketing labels).
  - If you later need to distinguish variants, append something explicit (e.g. `bolt_model_3_lr`).

2) Add a row to `web/data/vehicles.tsv`

Columns:

- `provider_id`, `vehicle_id`, `vehicle_name`, `vehicle_class`, `snowboard_fit`, `snowboard_source_url`

Guidance:

- `vehicle_name`: the human-readable model name shown in the app.
- `vehicle_class`: optional; keep blank unless you actively use it for grouping.
- `snowboard_fit`: `0` / `1` / `2` (comfort rating for a ~163cm bulky snowboard bag with boots; front passenger usable).
- `snowboard_source_url`: any supporting link (or a screenshot link / note).

3) Generate a snowboard-metadata checklist (optional)

- `uv run python scripts/snowboard_queue.py`

If your new Bolt row has blank `snowboard_fit`, paste the output into your PR description so it’s easy to backfill later.

## Step-by-step: add Bolt pricing (options)

Bolt pricing is represented using the same schema as other providers: one row in `web/data/options.tsv` is one option the calculator can price/rank.

1) Decide what you’re modeling

Common patterns:

- PAYG: time + km rates (option_type = `PAYG`)
- Packages: “X minutes + Y km” style bundles (option_type = `PACKAGE`)
- Daily rentals: 24h blocks, sometimes with included km (option_type = `DAILY`)

2) Add one or more rows to `web/data/options.tsv`

Required identity fields:

- `provider_id`: `bolt`
- `vehicle_id`: must match the row you added in `web/data/vehicles.tsv`
- `option_id`: unique and stable, e.g. `bolt_model_3_payg` or `bolt_yaris_cross_60min_50km`
- `option_name`: what the UI should display (include enough detail to distinguish options)
- `option_type`: `PAYG` / `PACKAGE` / `DAILY`

Pricing fields to fill (depends on type):

- For `PAYG`:
  - `trip_fee_eur` / `unlock_fee_eur` / `reservation_fee_eur` / `fixed_fee_eur` (as needed)
  - `drive_day_min_rate_eur`, `drive_night_min_rate_eur`
  - `park_day_min_rate_eur`, `park_night_min_rate_eur` (or leave blank to use drive rates if that’s how the app models it)
  - `km_rate_eur`
  - Optional constraints: `min_total_eur`, `cap_24h_eur`, `airport_fee_eur`
- For `PACKAGE`:
  - `package_price_eur`, `included_min`, `included_km`
  - `km_rate_eur` (used for overage fallback), `over_km_rate_eur` (if different)
  - Fees (`trip_fee_eur`, etc.) if applicable
- For `DAILY`:
  - `daily_price_eur`
  - `daily_unlimited_km` = `TRUE` (or set `daily_included_km` and `daily_over_km_rate_eur`)

Auditability:

- Fill `source_url` with whatever you used (screenshots are fine, but prefer a stable link if available).
- Use `notes` for “as seen in-app on YYYY-MM-DD”, zone assumptions, or quirks.

3) Keep values consistent with the calculator

- Booleans in TSV are `TRUE` / `FALSE`.
- Money values are plain decimals (e.g. `0.99`, `2`, `12.5`).

## Verify locally

From repo root:

- `just test` (or at least run both `npm test` and Python `unittest`)
- `npm test`
- `uv run python -m unittest discover -s tests/py -t .`
- `npx --yes serve -l 8000 web` and sanity-check the UI

## Faster workflow: tiers (clone instead of re-entering 60+ rows)

If Bolt has multiple cars with identical package menus (tiers), you can avoid re-entering all package rows:

1) Pick a tier representative

- Use a Bolt vehicle that already has the full package set in `web/data/options.tsv` (including any “daily”/rental bundles you care about).
- If a tier is missing packages, add them once to the representative first.

2) For each new car in that tier, only capture what differs

- Usually: PAYG screen only (minute/km/minimum/cap) + confirm the tier matches.

3) Clone rows with a script

- Dry-run (prints TSV snippets to paste):
  - `uv run python scripts/bolt_clone_tier.py --from-vehicle-id bolt_vw_tayron --to-vehicle-id bolt_vw_id4 --to-vehicle-name "VW ID.4" --snowboard-fit 2`
- Apply directly:
  - `uv run python scripts/bolt_clone_tier.py --apply --from-vehicle-id bolt_vw_tayron --to-vehicle-id bolt_vw_id4 --to-vehicle-name "VW ID.4" --snowboard-fit 2 --as-of 2026-01-24`

Optional overrides (if PAYG differs from the representative):

- `--minute-rate 0.15`, `--km-rate 0.30`, `--min-total 2.75`, `--cap-24h 27.90`, `--airport-fee 3.5`

## PR checklist

- Added Bolt vehicle row(s) in `web/data/vehicles.tsv`
- Added Bolt option row(s) in `web/data/options.tsv`
- Included a source (or notes) for each new/changed Bolt option
- If snowboard metadata is blank: included `scripts/snowboard_queue.py` output in the PR description
