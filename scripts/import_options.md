# Importing options (rates)

Updates `templates/sheets/Options.tsv` by pulling current public pricing data:

- CityBee: parses the built-in calculator car list on `https://citybee.lv/lv/cenas/` and generates:
  - PAYG per-minute + per-km options
  - 1h and 1d modeled as `PACKAGE` rows (approximation)
- CarGuru: uses `https://go-rest.carguru.online/public/web/rate/short` and generates:
  - PAYG rows per car + tariff (“Main Basic”, “Split Pro”, etc.)
  - “period” bundles modeled as `PACKAGE` rows

Run:

- `uv run python scripts/import_options.py`

Notes:

- Bolt Drive pricing is still manual (in-app).
- CityBee “hour/day/week/4 weeks” billing may be caps rather than true packages; we model 1h/1d as packages for now.
