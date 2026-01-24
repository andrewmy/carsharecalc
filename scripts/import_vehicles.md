# Importing vehicles

Updates `web/data/vehicles.tsv` by pulling current public vehicle lists:

- CityBee: parses the car selector on `https://citybee.lv/lv/cenas/`
- CarGuru: uses `https://go-rest.carguru.online/public/web/rate/short`

Run:

- `uv run python scripts/import_vehicles.py`

Notes:

- This only populates the **vehicle list** (not pricing options).
- Bolt Drive vehicles are still meant to be added manually as they appear in-app.
  - Bolt data entry workflow: `docs/bolt-drive-data-entry.md`.

## Snowboard metadata workflow

`web/data/vehicles.tsv` includes these extra columns:

- `snowboard_fit`: `0` / `1` / `2` (comfort rating for a ~163cm bulky snowboard bag with boots; front passenger usable)
- `snowboard_source_url`: link supporting the decision (or notes/screenshot link)
- `fuel_type`: `petrol` / `diesel` / `ev` (hybrids treated as petrol)
- `consumption_l_per_100km_default`: fuel consumption estimate (used when fuel isn’t included; EVs leave blank). Prefer worst-case (least efficient) published figure to avoid underestimating; the app applies an additional hardcoded Riga multiplier (×1.15) when calculating fuel cost.
- `consumption_source_url`: link supporting the estimate (can reuse `snowboard_source_url` if it contains specs)

The web app’s snowboard filter keeps vehicles with `snowboard_fit >= 1`.

### Recommended PR workflow

1) Add/refresh vehicles:
   - CityBee/CarGuru: `uv run python scripts/import_vehicles.py`
   - Bolt/manual: edit `web/data/vehicles.tsv` directly
2) If you don’t know snowboard fitment yet, leave `snowboard_fit` / `snowboard_source_url` blank for new rows.
3) Run `uv run python scripts/snowboard_queue.py` and paste the output into the PR description as a checklist.
4) Run `uv run python scripts/consumption_queue.py` and paste the output into the PR description as a checklist.
   - Optional: `uv run python scripts/fill_consumption.py --apply` to auto-fill some consumption values from known sources.
5) Apply the same rating to any existing matching models in `vehicles.tsv`.

### Important

`scripts/import_vehicles.py` preserves existing extra columns (including snowboard + fuel metadata) by merging refreshed rows into the existing TSV keyed by `(provider_id, vehicle_id)`.
