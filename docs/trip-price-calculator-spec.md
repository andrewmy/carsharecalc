# Riga Car‑Share Trip Price Calculator — Spec (MVP)

## Goal
Given a planned trip in **Riga, Latvia**, estimate total trip cost across **CarGuru**, **CityBee**, and **Bolt Drive** for **all available vehicles and pricing options** (pay‑as‑you‑go, time+km packages, daily rentals, etc.), including overage fees, then **rank cheapest → most expensive**.

## Scope (MVP)
- City: **Riga only** (explicitly note future expansion to other cities/zones).
- Prices: **VAT included** (what a user pays).
- Promotions/subscriptions: **ignored** (note for future).
- Output: “expected total”; provide a **breakdown** in a details area.
- Zones: single toggle **Airport zone (either pickup or dropoff)**; note future split into two toggles and more zones.
- Bolt Drive rates: **manual entry** using the same pricing schema.

## Inputs
Required
- `Start datetime` (Europe/Riga)
- `Total rental time` (HH:MM)
- `Trip distance` (km)

Optional
- `Parking/standstill time` (HH:MM, must be ≤ total; default `00:00`)
- `Airport zone` (checkbox)
- Fuel model (for tariffs where fuel is not included):
  - `Fuel price (€/L)` (default: configurable)
  - `Consumption (L/100km)` (default: configurable)

User warning
- Assumes **one‑way**. If returning, user should add return time/distance to inputs.

## Rounding & Derived Values
- Minutes billed: **round up to next minute**
- Distance billed: **round up to next km**
- Prices: **round up to €0.01**

Derived
- `total_min` = ceil(total time to minutes)
- `park_min` = ceil(parking time to minutes); `drive_min` = `total_min - park_min`
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

Then apply PAYG constraints (if defined):
- minimum charge: `min_total_eur` caps *up* the PAYG base (trip fee + time + distance)
- daily cap: `cap_24h_eur` caps *down* the PAYG base per started 24h block (`ceil(total_min/1440) * cap_24h_eur`)
Notes:
- Airport fees and fuel are **added after** min/cap (provider-specific; adjust if needed later).

### 2) Upfront package (PACKAGE)
Represents “buy X minutes + Y km” (CityBee packs, etc.).
Total = package price + fees + overage + airport + fuel (if not included)
- Included minutes and km reduce billed usage:
  - `over_min = max(0, total_min - included_min)`
  - `over_km = max(0, dist_km - included_km)`
- Overage pricing:
  - if explicit `over_min_rate_*`/`over_km_rate` provided, use them
  - else default to the option’s PAYG rates
- Day/night split for overage minutes (MVP implementation detail):
  - compute the trip’s **blended per‑minute rate** from PAYG time charges:
    - `blended_min_rate = payg_time_eur / total_min`
  - `over_time_eur = over_min * blended_min_rate`
  - This is equivalent to proportional allocation across minute categories, and is much simpler to implement in Sheets.
  - (future: exact timeline allocation or min/max bounds)

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
Round up to €0.01 and add to total.

## Google Sheets Implementation (MVP)
Deliverable: a single Google Sheet with the following tabs.

Repo helpers (optional)
- `templates/sheets/SETUP.md` provides a fast “copy/paste” build for the sheet.
- `templates/sheets/apps_script.gs` provides the `NIGHT_MINUTES(...)` custom function used by the templates.

### Tab: `Inputs`
Cells (suggested)
- `B2` Start datetime
- `B3` Total time (HH:MM)
- `B4` Parking time (HH:MM, default 0)
- `B5` Distance (km)
- `B6` Airport zone (TRUE/FALSE)
- `B8` Fuel price (€/L)
- `B9` Consumption (L/100km)
- Computed fields: `total_min`, `park_min`, `dist_km`, plus per‑provider `night_min` (see `Providers`).

### Tab: `Providers`
Columns
- `provider_id` (stable key: `carguru`, `citybee`, `bolt`)
- `provider_name`
- `night_start` (time)
- `night_end` (time)
- `notes`

### Tab: `Vehicles`
Columns
- `provider_id`
- `vehicle_id` (stable key per provider)
- `vehicle_name` (what users recognize)
- `vehicle_class` (optional; future filters)

### Tab: `Options`
One row = one purchasable/choosable pricing option for a vehicle.

Core columns
- IDs: `provider_id`, `vehicle_id`, `option_id`, `option_name`, `option_type` (`PAYG`/`PACKAGE`/`DAILY`)
- Fees: `unlock_fee_eur`, `reservation_fee_eur`, `fixed_fee_eur`, `airport_fee_eur`
- Trip constraints (used by some providers):
  - `trip_fee_eur` (one-time per trip; CityBee-style)
  - `min_total_eur` (minimum charge for PAYG base usage)
  - `cap_24h_eur` (PAYG daily cap per started 24h block; applied to PAYG base usage)
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
- `over_day_min_rate_eur` / `over_night_min_rate_eur` (blank = use drive rates)

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

### Tab: `Results`
Computed output table (one row per `Options` row):
- provider, vehicle, option, computed total (€, rounded up to 0.01)
- computed components (fees/time/km/airport/fuel) in hidden/helper columns
- filter controls (provider/vehicle/type) using built‑in Sheets filters
- ranked list: sort by computed total ascending

### Tab: `Details`
User picks an `option_id` (dropdown) and the sheet shows:
- total price
- breakdown: fees, time, distance, airport, fuel
- the exact minutes/km used and included/overage

## Data Entry Workflow (Rates)
1) Add/verify provider night windows in `Providers`.
2) Add vehicles in `Vehicles`.
3) Create option rows in `Options` for each tariff/package/daily rental on:
   - CarGuru: `https://carguru.lv/rates`
   - CityBee: `https://citybee.lv/lv/cenas/` and `https://citybee.lv/lv/pakas/`
   - Bolt: manual from in‑app screens
4) Results auto‑recompute and re‑rank.

## Future Enhancements
- Split “Airport zone” into `pickup_at_airport` and `dropoff_at_airport`; add multiple zones.
- Add car class/model selector and city selector (rates can differ).
- Add discounts/subscriptions/promos and minimum/maximum caps where applicable.
- Improve parking timeline modeling (parking at end vs explicit parking intervals).
- Optional package stacking (explicitly off for MVP).
