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

- `snowboard_ok`: `TRUE` / `FALSE` / blank (blank = unknown)
- `snowboard_source_url`: link supporting the decision

The web app treats only `TRUE` as “fits snowboard”; `FALSE` and blank are both treated as not matching the filter.

### Recommended PR workflow

1) Add/refresh vehicles:
   - CityBee/CarGuru: `uv run python scripts/import_vehicles.py`
   - Bolt/manual: edit `web/data/vehicles.tsv` directly
2) Leave `snowboard_ok` / `snowboard_source_url` blank for new rows if unknown.
3) Run `uv run python scripts/snowboard_queue.py` and paste the output into the PR description as a checklist.
4) Fill in `snowboard_ok` and `snowboard_source_url` for the new model(s), and apply the same decision to any existing matching models in `vehicles.tsv`.

### Important

`scripts/import_vehicles.py` preserves existing extra columns (including snowboard metadata) by merging refreshed rows into the existing TSV keyed by `(provider_id, vehicle_id)`.
