# CarShareCalc

No-build web app to estimate and compare car sharing trip prices in **Riga** across **CarGuru**, **CityBee**, and **Bolt Drive**.

## Run locally

- `uv sync`
- `uv run python -m http.server 8000`
- Open `http://localhost:8000/web/`

## Tests

- `npm test`

## Data

Source-of-truth TSVs (commit changes here):

- `web/data/providers.tsv`
- `web/data/vehicles.tsv`
- `web/data/options.tsv`

Update CarGuru/CityBee data (Bolt is manual):

- `uv run python scripts/import_vehicles.py`
- `uv run python scripts/import_options.py`

The app also supports local TSV overrides via the **Advanced** dialog (saved in browser localStorage).

## Localization

- UI supports `LV`/`EN` (dropdown in the header).
- User choice persists in localStorage; otherwise we detect browser language with fallback to Latvian.
- Edit strings in `web/lib/i18n.js`.

