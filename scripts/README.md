# Scripts

## `generate_xlsx_template.py`

Generates `carcalc-template.xlsx` (an importable starter workbook for Google Sheets).

Run:

- `. .venv/bin/activate && python scripts/generate_xlsx_template.py`

Notes:

- The workbook embeds Google Sheets formulas (e.g., `ARRAYFORMULA`). Excel will not evaluate them, but Google Sheets will after upload.
- Night-minute calculation still requires adding the Apps Script function from `templates/sheets/apps_script.gs` (see `templates/sheets/SETUP.md`).

