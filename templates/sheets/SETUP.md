# Google Sheets Setup (MVP)

## 1) Create the sheet + tabs
Create a new Google Sheet (set timezone to **Europe/Riga**) and add tabs with these exact names:

- `Inputs`
- `Providers`
- `Vehicles`
- `Options`
- `Results`
- `Details`

## 2) Paste the TSV templates
For each tab, paste the matching TSV file starting at cell `A1`:

- `templates/sheets/Inputs.tsv` (recommended; uses Apps Script for night minutes)
- `templates/sheets/Providers.tsv`
- `templates/sheets/Vehicles.tsv`
- `templates/sheets/Options.tsv`
- `templates/sheets/Results.tsv`
- `templates/sheets/Details.tsv`

Tip: After pasting `Inputs.tsv`, format `Inputs!B3:B4` as **Duration**.

If you want a “pure formulas / no Apps Script” setup:
- use `templates/sheets/Inputs.manual_night.tsv` instead of `templates/sheets/Inputs.tsv`
- manually fill `Inputs!D18:D20` (night minutes per provider)

## Alternative: upload the prebuilt XLSX
If you want something closer to “done immediately”, you can upload:

- `carcalc-template-gs.xlsx` (auto night minutes; requires Apps Script)
- `carcalc-template-manual-night-gs.xlsx` (no Apps Script; enter night minutes manually)

Note: these “-gs” files embed Google Sheets-only formulas (like `ARRAYFORMULA`). Excel may show repair warnings; Google Sheets will evaluate them correctly after upload.

## 3) Add the custom function (recommended)
This avoids a very large formula for “night minutes”.

1. Open **Extensions → Apps Script**
2. Paste `templates/sheets/apps_script.gs` as the project code
3. Save

Now `Inputs` will compute `night_min` via `NIGHT_MINUTES(...)`.

## 4) Add `Results` formulas
After pasting `templates/sheets/Results.tsv` (headers only):

- `Results!A2`:
  - `=FILTER(Options!A:AE,Options!A:A<>"")`

Then add these formulas (they should spill down automatically):

- `Results!AH2` (fees_eur):
  - `=ARRAYFORMULA(IF(A2:A="","",ROUNDUP(F2:F+G2:G+H2:H,2)))`
- `Results!AI2` (time_eur):
  - `=ARRAYFORMULA(IF(A2:A="","",ROUNDUP(IF(E2:E="PAYG",(IFNA(VLOOKUP(A2:A,Inputs!A18:I,9,FALSE),0)*M2:M+IFNA(VLOOKUP(A2:A,Inputs!A18:I,8,FALSE),0)*N2:N+IFNA(VLOOKUP(A2:A,Inputs!A18:I,7,FALSE),0)*IF(O2:O="",M2:M,O2:O)+IFNA(VLOOKUP(A2:A,Inputs!A18:I,6,FALSE),0)*IF(P2:P="",N2:N,P2:P)),IF(E2:E="PACKAGE",(IF(Inputs!B12-IFNA(U2:U,0)>0,Inputs!B12-IFNA(U2:U,0),0)*IF(Inputs!B12=0,0,(IFNA(VLOOKUP(A2:A,Inputs!A18:I,9,FALSE),0)*IF(X2:X="",M2:M,X2:X)+IFNA(VLOOKUP(A2:A,Inputs!A18:I,8,FALSE),0)*IF(Y2:Y="",N2:N,Y2:Y)+IFNA(VLOOKUP(A2:A,Inputs!A18:I,7,FALSE),0)*IF(X2:X="",M2:M,X2:X)+IFNA(VLOOKUP(A2:A,Inputs!A18:I,6,FALSE),0)*IF(Y2:Y="",N2:N,Y2:Y))/Inputs!B12)),0)),2)))`
- `Results!AJ2` (km_eur):
  - `=ARRAYFORMULA(IF(A2:A="","",ROUNDUP(IF(E2:E="PAYG",IF(IFNA(V2:V,0)>0,(IF(Inputs!B14-IFNA(V2:V,0)>0,Inputs!B14-IFNA(V2:V,0),0)*IF(W2:W="",Q2:Q,W2:W)),Inputs!B14*Q2:Q),IF(E2:E="PACKAGE",(IF(Inputs!B14-IFNA(V2:V,0)>0,Inputs!B14-IFNA(V2:V,0),0)*IF(W2:W="",Q2:Q,W2:W)),IF(E2:E="DAILY",IF(AB2:AB,0,(IF(Inputs!B14-IFNA(AA2:AA,0)*CEILING(Inputs!B12/1440,1)>0,Inputs!B14-IFNA(AA2:AA,0)*CEILING(Inputs!B12/1440,1),0)*IF(AC2:AC="",Q2:Q,AC2:AC))),0))),2)))`
- `Results!AK2` (airport_eur):
  - `=ARRAYFORMULA(IF(A2:A="","",ROUNDUP(IF(Inputs!B6,IFNA(L2:L,0),0),2)))`
- `Results!AL2` (fuel_eur):
  - `=ARRAYFORMULA(IF(A2:A="","",IF(R2:R,0,ROUNDUP(Inputs!B14*(Inputs!B9/100)*Inputs!B8,2))))`
- `Results!AG2` (base_eur):
  - `=ARRAYFORMULA(IF(A2:A="","",ROUNDUP(IF(E2:E="PAYG",IFNA(I2:I,0)+AI2:AI+AJ2:AJ,IF(E2:E="PACKAGE",IFNA(T2:T,0)+AI2:AI+AJ2:AJ,IF(E2:E="DAILY",CEILING(Inputs!B12/1440,1)*IFNA(Z2:Z,0)+AJ2:AJ,NA()))),2)))`
- `Results!AF2` (total_eur):
  - `=ARRAYFORMULA(IF(A2:A="","",ROUNDUP((IF(E2:E="PAYG",IF(IF(AG2:AG<IFNA(J2:J,0),IFNA(J2:J,0),AG2:AG)>IF(IFNA(K2:K,0)>0,CEILING(Inputs!B12/1440,1)*K2:K,1E99),IF(IFNA(K2:K,0)>0,CEILING(Inputs!B12/1440,1)*K2:K,1E99),IF(AG2:AG<IFNA(J2:J,0),IFNA(J2:J,0),AG2:AG)),AG2:AG)+AH2:AH+AK2:AK+AL2:AL,2)))`

## 5) Enter pricing
Fill in:

- `Providers`: verify night windows (placeholders are included)
- `Vehicles`: add all vehicles/categories you want to price
- `Options`: add one row per pricing option (PAYG, PACKAGE, DAILY)

`Results` will auto-calculate and can be sorted/filtered by total price.

## Adding a new car later (manual workflow)
Since availability changes, keep this lightweight:

1) Add one row to `Vehicles`:
- `provider_id` = `bolt` / `citybee` / `carguru`
- `vehicle_id` = stable key (e.g., `bolt_corolla_hybrid`)
- `vehicle_name` = what you see in-app

2) Add 1+ rows to `Options` for that `vehicle_id`:
- PAYG: fill `trip_fee_eur`, `min_total_eur`, `cap_24h_eur` (if any), per-minute and per-km
- Packages: add one `PACKAGE` row per time+km bundle (set `package_price_eur`, `included_min`, `included_km`, `over_km_rate_eur`)
- If fuel is not included, set `fuel_included=FALSE` and the calculator will add the fuel model from `Inputs`.

Notes:
- If a provider has “free km included” on PAYG, set `included_km` + `km_rate_eur` as the overage rate.
- If a provider has a PAYG daily cap, set `cap_24h_eur`. The template caps only the PAYG base (trip fee + time + km), then adds airport/fuel on top.
