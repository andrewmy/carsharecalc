# Importing vehicles

Updates `templates/sheets/Vehicles.tsv` by pulling current public vehicle lists:

- CityBee: parses the car selector on `https://citybee.lv/lv/cenas/`
- CarGuru: uses `https://go-rest.carguru.online/public/web/rate/short`

Run:

- `. .venv/bin/activate && python scripts/import_vehicles.py`

Notes:

- This only populates the **vehicle list** (not pricing options).
- Bolt Drive vehicles are still meant to be added manually as they appear in-app.

