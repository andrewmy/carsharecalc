# CarShareCalc

No-build web app to estimate and compare car sharing trip prices in **Riga** across **CarGuru**, **CityBee**, and **Bolt Drive**.

## Run locally

- `npx --yes serve -l 8000 web`
- Open `http://localhost:8000/`

## Tests

- `just test` (runs JS + Python)
- `npm test`
- `uv run python -m unittest discover -s tests/py -t .`

## Data

Source-of-truth TSVs (commit changes here):

- `web/data/providers.tsv`
- `web/data/vehicles.tsv`
- `web/data/options.tsv`

Bolt Drive data entry (manual):

- `docs/bolt-drive-data-entry.md`

Update CarGuru/CityBee data (Bolt is manual):

- `uv sync`
- `uv run python scripts/import_vehicles.py`
- `uv run python scripts/import_options.py`

Fuel consumption metadata helpers (optional):

- `uv run python scripts/consumption_queue.py`
- `uv run python scripts/fill_consumption.py --apply`

The app also supports local TSV overrides via the **Advanced** dialog (saved in browser localStorage).

## Localization

- UI supports `LV`/`EN` (dropdown in the header).
- User choice persists in localStorage; otherwise we detect browser language with fallback to Latvian.
- Edit strings in `web/lib/i18n.js`.

## Browser dark-mode overrides

Some mobile browsers (notably Samsung Internet) offer a user-controlled “force dark mode for web pages.”
When enabled, the browser can recolor pages after CSS is applied. This override cannot be fully
prevented by app-side CSS or meta tags, so the only reliable fix is disabling the browser’s force-dark
setting for the site.
