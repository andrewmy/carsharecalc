# CarShareCalc (Riga) — Spec (MVP)

## Goal
Given a planned trip in **Riga, Latvia**, estimate total trip cost across **CarGuru**, **CityBee**, and **Bolt Drive** for **all available vehicles and pricing options** (pay‑as‑you‑go, time+km packages, daily rentals, etc.), including overage fees, then **rank cheapest → most expensive**.

## Scope (MVP)
- City: **Riga only** (explicitly note future expansion to other cities/zones).
- Prices: **VAT included** (what a user pays).
- Promotions/subscriptions: **ignored** (note for future).
- Output: “expected total”; provide a **breakdown** on demand.
- Zones: single toggle **Airport zone (either pickup or dropoff)**; note future split into two toggles and more zones.
- Bolt Drive rates: **manual entry** using the same pricing schema.
- Parking fees as a separate concept: **not modeled** yet (note for future; some daily rentals exclude parking).

## Inputs
Required
- `Start datetime` (entered via `datetime-local` and interpreted as the device’s local time; for Riga accuracy set device timezone to Europe/Riga)
- `Total rental time` (H:MM / HH:MM)
- `Trip distance` (km)

Optional
- `Parking/standstill time` (H:MM / HH:MM, must be ≤ total; default `0:00`)
- `Airport zone` (checkbox)
- Fuel model (for tariffs where fuel is not included):
  - `Fuel price (€/L)` (default: configurable)
  - `Consumption (L/100km)` (default: configurable)

User warning
- Assumes **one‑way**. If returning, user should add return time/distance to inputs.

## Rounding & Derived Values
- Time input is H:MM / HH:MM (minute resolution; minutes must be `00`–`59`).
- Distance billed: **round up to next km**
- Prices: **round to €0.01** (standard rounding)

Derived
- `total_min` = total time in minutes
- `park_min` = parking time in minutes; `drive_min` = `total_min - park_min`
- `dist_km` = ceil(distance to km)
- Provider night minutes computed from `[start_ts, end_ts)` and each provider’s `night_start`, `night_end`.
  - `night_min` = overlap minutes with the nightly interval(s)
  - `day_min` = `total_min - night_min`

Parking night allocation (MVP assumption)
- Parking is assumed **proportional across the trip**:
  - `park_night_min` = ceil(`park_min * night_min / total_min`)
  - Clamp so `park_night_min ≤ min(park_min, night_min)`
  - `park_day_min = park_min - park_night_min`
  - `drive_night_min = night_min - park_night_min`
  - `drive_day_min = day_min - park_day_min`
Note: This is ambiguous without a parking timeline; call out as a future improvement.

## Pricing Models (per option row)
Each option (provider + vehicle + tariff/package) produces a single computed price.

### 1) Pay‑as‑you‑go (PAYG)
Total = sum of:
- fixed fees: unlock/start/reservation (as defined)
- trip fee (one-time per trip), if any
- time charges (minutes):
  - drive: day/night per‑minute rates
  - parking: day/night per‑minute rates (default to drive rates if not differentiated)
- distance charge: per‑km rate (optionally with a “free km” threshold)
- zone fees: airport fee if toggle enabled
- fuel cost if fuel not included

Then apply constraints (if defined) as implemented today:
- daily cap: `cap_24h_eur` caps *down* **time charges only** per started 24h block (`ceil(total_min/1440) * cap_24h_eur`)
- minimum charge: `min_total_eur` caps *up* the subtotal `(trip_fee + time + km)` **after** the time cap is applied
Notes (current MVP behavior):
- Fixed fees (`unlock_fee_eur`, `reservation_fee_eur`, `fixed_fee_eur`), airport fees, and fuel are **added after** min/cap.

### 2) Upfront package (PACKAGE)
Represents “buy X minutes + Y km” (CityBee packs, etc.).
Total = package price + fees + overage + airport + fuel (if not included)
- Included minutes and km reduce billed usage:
  - `over_min = max(0, total_min - included_min)`
  - `over_km = max(0, dist_km - included_km)`
- Overage pricing:
  - km overage uses `over_km_rate_eur` if present, otherwise `km_rate_eur`
  - minute overage (current MVP): uses a **blended per‑minute rate** derived from PAYG time charges:
    - `blended_min_rate = payg_time_eur / total_min`
    - `over_time_eur = over_min * blended_min_rate`
    - This is equivalent to proportional allocation across minute categories, and keeps the MVP simple.
    - `over_day_min_rate_eur` / `over_night_min_rate_eur` exist in the schema but are **not used yet** by the calculator.

Important: show “effective trip cost” even if usage is far below included amounts (e.g., 1 km trip in 100 km pack costs full pack price).

### 3) Daily rental (DAILY)
Assume “day” = **24h blocks**:
- `days = ceil(total_min / 1440)`
Total = days * daily_price + (optional km overage) + fees + airport + fuel (if not included)
- Support:
  - unlimited km (no km overage)
  - included km/day (multiply by `days`)
  - km overage rate

## Fuel Cost
Apply when an option marks `fuel_included = FALSE`:
- `fuel_cost = dist_km * (consumption_l_per_100km / 100) * fuel_price_per_l`
Round to €0.01 and add to total.

## Web App Implementation (current MVP)
The primary deliverable is the **no-build web app** in `web/` (desktop + mobile).

Run locally:
- `uv sync`
- `npx --yes serve -l 8000 web` → open `http://localhost:8000/`

Data:
- Source-of-truth TSVs live in `web/data/` and are committed to the repo.
- The app supports local TSV overrides via the “Advanced” dialog (saved in browser localStorage; not shared).

Localization:
- UI supports **LV/EN** with a dropdown; user selection persists in the browser.
- User selection overrides browser preferences; if no user choice is stored, use browser preferences when available, otherwise fall back to **Latvian**.
- UI strings are edited in `web/lib/i18n.js` (data-driven vehicle/option names are not translated yet).

Tests:
- Unit tests use Node’s built-in runner: `npm test`.

## Data Schema (TSV)
One row in `web/data/options.tsv` represents one purchasable/choosable pricing option for a vehicle.

`web/data/vehicles.tsv` contains the vehicle list and metadata:

- IDs: `provider_id`, `vehicle_id`, `vehicle_name`, `vehicle_class`
- Snowboard filter metadata: `snowboard_ok` (`TRUE`/`FALSE`/blank) and `snowboard_source_url`
  - Blank means “unknown” and is treated the same as `FALSE` by the filter (only `TRUE` matches).

Core columns
- IDs: `provider_id`, `vehicle_id`, `option_id`, `option_name`, `option_type` (`PAYG`/`PACKAGE`/`DAILY`)
- Fees: `unlock_fee_eur`, `reservation_fee_eur`, `fixed_fee_eur`, `airport_fee_eur`
- Trip constraints (used by some providers):
  - `trip_fee_eur` (one-time per trip; CityBee-style)
  - `min_total_eur` (minimum charge; applied to `(trip_fee + plan + time + km)` before fees/airport/fuel are added; for PAYG, `plan=0`)
  - `cap_24h_eur` (daily cap per started 24h block; **currently applied to time charges only**)
- Time rates:
  - `drive_day_min_rate_eur`, `drive_night_min_rate_eur`
  - `park_day_min_rate_eur`, `park_night_min_rate_eur` (default = drive rates)
- Distance:
  - `km_rate_eur` (PAYG per-km, if applicable)
  - `included_km` (free km threshold; if >0, only `max(0, dist_km - included_km)` is billed)
  - `over_km_rate_eur` (fallback: `km_rate_eur`)

PACKAGE columns (nullable for other types)
- `package_price_eur`
- `included_min`
- `included_km` (also used as PAYG free km threshold)
- `over_km_rate_eur` (also used for PAYG km overage; blank = use `km_rate_eur`)
- `over_day_min_rate_eur` / `over_night_min_rate_eur` (reserved; currently not used by the calculator)

DAILY columns (nullable for other types)
- `daily_price_eur`
- `daily_included_km` (blank + `daily_unlimited_km=TRUE` means unlimited)
- `daily_unlimited_km` (TRUE/FALSE)
- `daily_over_km_rate_eur`

Flags / notes
- `fuel_included` (TRUE/FALSE)
- `parking_included` (TRUE/FALSE; MVP informational only)
- `source_url` (for auditability)
- `notes`

## Non-goals
- Not specified yet.

## Data Entry Workflow (Rates)
1) Add/verify provider night windows in `web/data/providers.tsv`.
2) Add vehicles in `web/data/vehicles.tsv`.
   - If you add new vehicles and don’t know snowboard fitment yet, leave `snowboard_ok` / `snowboard_source_url` blank.
   - Use `uv run python scripts/snowboard_queue.py` to generate a PR checklist of missing snowboard metadata.
3) Create option rows in `web/data/options.tsv` for each tariff/package/daily rental on:
   - CarGuru: `https://carguru.lv/rates`
   - CityBee: `https://citybee.lv/lv/cenas/` and `https://citybee.lv/lv/pakas/`
   - Bolt: manual from in‑app screens
4) Update `web/data/*.tsv` (either manually or via scripts):
   - `uv run python scripts/import_vehicles.py`
   - `uv run python scripts/import_options.py`

## Implementation Notes (current code)
- `cap_24h_eur` is applied to **time charges only** for `PAYG` and `PACKAGE` (minute overage), not to km or fees.
- `min_total_eur` is applied to `(trip_fee + plan + time + km)` before fixed fees, airport, and fuel are added (most data only uses it for PAYG).
- CarGuru quirks in `web/lib/calc.js`:
  - If `fixed_fee_eur` is missing/0 (non-DAILY), a default service fee of `€0.99` is assumed.
  - If `min_total_eur` is missing/0 for CarGuru PAYG, a default minimum of `€2.00` is assumed.

## Future Enhancements
- Split “Airport zone” into `pickup_at_airport` and `dropoff_at_airport`; add multiple zones.
- Add car class/model selector and city selector (rates can differ).
- Add more languages/locales.
- Add discounts/subscriptions/promos and minimum/maximum caps where applicable.
- Improve parking timeline modeling (parking at end vs explicit parking intervals).
- Optional package stacking (explicitly off for MVP).
