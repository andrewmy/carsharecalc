from __future__ import annotations

import csv
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen


def fetch_text(url: str) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": "carcalc/0 (import script; https://example.invalid)",
            "Accept": "text/html,application/json",
        },
    )
    with urlopen(req, timeout=30) as resp:
        data = resp.read()
    return data.decode("utf-8", errors="ignore")


def fetch_json(url: str) -> object:
    req = Request(
        url,
        headers={
            "User-Agent": "carcalc/0 (import script; https://example.invalid)",
            "Accept": "application/json",
        },
    )
    with urlopen(req, timeout=30) as resp:
        data = resp.read()
    return json.loads(data.decode("utf-8", errors="strict"))


def slugify(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "x"


def parse_money(v: object) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if not s:
        return ""
    s = s.replace("\xa0", " ").replace("€", "").replace("EUR", "").strip()

    # Support common European formatting:
    # - "1 010" (space thousands)
    # - "1.010" (dot thousands)
    # - "1,50" (comma decimal)
    if "," in s:
        s = s.replace(".", "").replace(" ", "").replace(",", ".")
    else:
        s = re.sub(r"\s+", "", s)
        # Only treat dot-grouping as thousands if the integer part isn't 0
        # (avoids mis-parsing values like 0.280).
        if re.fullmatch(r"-?\d{1,3}(?:\.\d{3})+", s) and not re.fullmatch(r"-?0\.\d{3}", s):
            s = s.replace(".", "")

    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return m.group(0) if m else ""


def parse_int(v: object) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if not s:
        return ""
    s = s.replace("\xa0", " ")
    s = re.sub(r"\s+", "", s)
    if re.fullmatch(r"-?\d{1,3}(?:\.\d{3})+", s):
        s = s.replace(".", "")
    m = re.search(r"-?\d+", s)
    return m.group(0) if m else ""


def duration_to_minutes(time_str: str) -> int:
    # CarGuru uses strings like 1h, 3h, 3d, 7d, 14d, 30d
    m = re.fullmatch(r"(\d+)\s*([hd])", time_str.strip().lower())
    if not m:
        raise ValueError(f"Unsupported duration: {time_str!r}")
    n = int(m.group(1))
    unit = m.group(2)
    return n * (60 if unit == "h" else 1440)


@dataclass(frozen=True)
class OptionRow:
    provider_id: str
    vehicle_id: str
    option_id: str
    option_name: str
    option_type: str  # PAYG / PACKAGE / DAILY
    unlock_fee_eur: str = "0"
    reservation_fee_eur: str = "0"
    fixed_fee_eur: str = "0"
    trip_fee_eur: str = "0"
    min_total_eur: str = ""
    cap_24h_eur: str = ""
    airport_fee_eur: str = ""
    drive_day_min_rate_eur: str = ""
    drive_night_min_rate_eur: str = ""
    park_day_min_rate_eur: str = ""
    park_night_min_rate_eur: str = ""
    km_rate_eur: str = ""
    fuel_included: str = "TRUE"
    parking_included: str = "TRUE"
    package_price_eur: str = ""
    included_min: str = ""
    included_km: str = ""
    over_km_rate_eur: str = ""
    over_day_min_rate_eur: str = ""
    over_night_min_rate_eur: str = ""
    daily_price_eur: str = ""
    daily_included_km: str = ""
    daily_unlimited_km: str = ""
    daily_over_km_rate_eur: str = ""
    source_url: str = ""
    notes: str = ""

    def as_dict(self) -> dict[str, str]:
        return {k: getattr(self, k) for k in self.__dataclass_fields__.keys()}


def parse_citybee_options_from_cenas(html: str) -> tuple[list[OptionRow], set[str]]:
    # Vehicles are keyed by the numeric value id in the selector. The selector also includes pricing attributes.
    m = re.search(r'<select[^>]*class="js-car-chooser"[^>]*>.*?</select>', html, re.DOTALL)
    if not m:
        raise RuntimeError("CityBee: could not find <select class=\"js-car-chooser\"> block")
    select_html = m.group(0)

    options: list[OptionRow] = []
    vehicle_ids: set[str] = set()

    for opt in re.finditer(r"<option\s+[^>]*>\s*([^<]+?)\s*</option>", select_html, re.DOTALL):
        tag = opt.group(0)
        name = opt.group(1).strip()

        value_m = re.search(r'\bvalue="(\d+)"', tag)
        if not value_m:
            continue
        value_id = value_m.group(1)
        vehicle_id = f"citybee_{value_id}"
        vehicle_ids.add(vehicle_id)

        km_rate = parse_money(re.search(r'\bdata-km="([^"]+)"', tag).group(1) if re.search(r'\bdata-km="([^"]+)"', tag) else "")
        min_rate = parse_money(re.search(r'\bdata-min="([^"]+)"', tag).group(1) if re.search(r'\bdata-min="([^"]+)"', tag) else "")
        hour_price = parse_money(re.search(r'\bdata-hour="([^"]+)"', tag).group(1) if re.search(r'\bdata-hour="([^"]+)"', tag) else "")
        day_price = parse_money(re.search(r'\bdata-day="([^"]+)"', tag).group(1) if re.search(r'\bdata-day="([^"]+)"', tag) else "")
        min_fee = parse_money(re.search(r'\bdata-min-fee="([^"]+)"', tag).group(1) if re.search(r'\bdata-min-fee="([^"]+)"', tag) else "")
        trip_fee = parse_money(re.search(r'\bdata-trip-fee="([^"]+)"', tag).group(1) if re.search(r'\bdata-trip-fee="([^"]+)"', tag) else "")

        if not (km_rate and min_rate):
            continue

        base_note = "Imported from citybee.lv pricing calculator attributes."
        payg = OptionRow(
            provider_id="citybee",
            vehicle_id=vehicle_id,
            option_id=f"{vehicle_id}_payg",
            option_name=f"PAYG ({name})",
            option_type="PAYG",
            trip_fee_eur=trip_fee or "0",
            min_total_eur=min_fee or "",
            drive_day_min_rate_eur=min_rate,
            drive_night_min_rate_eur=min_rate,
            park_day_min_rate_eur=min_rate,
            park_night_min_rate_eur=min_rate,
            km_rate_eur=km_rate,
            fuel_included="TRUE",
            parking_included="TRUE",
            source_url="https://citybee.lv/lv/cenas/",
            notes=base_note,
        )
        options.append(payg)

        # Approximate hour/day as explicit packages so they show up as separate ranked rows.
        # (This may differ from the app's exact billing; adjust if CityBee uses caps automatically.)
        if hour_price:
            options.append(
                OptionRow(
                    provider_id="citybee",
                    vehicle_id=vehicle_id,
                    option_id=f"{vehicle_id}_1h",
                    option_name=f"1h ({name})",
                    option_type="PACKAGE",
                    trip_fee_eur=trip_fee or "0",
                    drive_day_min_rate_eur=min_rate,
                    drive_night_min_rate_eur=min_rate,
                    park_day_min_rate_eur=min_rate,
                    park_night_min_rate_eur=min_rate,
                    km_rate_eur=km_rate,
                    package_price_eur=hour_price,
                    included_min="60",
                    included_km="0",
                    source_url="https://citybee.lv/lv/cenas/",
                    notes=base_note + " Modeled as a package.",
                )
            )

        if day_price:
            options.append(
                OptionRow(
                    provider_id="citybee",
                    vehicle_id=vehicle_id,
                    option_id=f"{vehicle_id}_1d",
                    option_name=f"1 day ({name})",
                    option_type="PACKAGE",
                    trip_fee_eur=trip_fee or "0",
                    drive_day_min_rate_eur=min_rate,
                    drive_night_min_rate_eur=min_rate,
                    park_day_min_rate_eur=min_rate,
                    park_night_min_rate_eur=min_rate,
                    km_rate_eur=km_rate,
                    package_price_eur=day_price,
                    included_min="1440",
                    included_km="0",
                    source_url="https://citybee.lv/lv/cenas/",
                    notes=base_note + " Modeled as a package.",
                )
            )

    return options, vehicle_ids


def parse_carguru_options_from_rate_short(obj: object) -> tuple[list[OptionRow], set[str]]:
    if not isinstance(obj, dict) or "result" not in obj:
        raise RuntimeError("CarGuru: unexpected JSON shape (missing 'result')")
    result = obj["result"]
    if not isinstance(result, list):
        raise RuntimeError("CarGuru: unexpected JSON shape ('result' not a list)")

    options: list[OptionRow] = []
    vehicle_ids: set[str] = set()

    for vehicle in result:
        if not isinstance(vehicle, dict):
            continue
        vid = vehicle.get("id")
        title = (vehicle.get("title") or "").strip()
        if not vid or not title:
            continue
        vehicle_id = f"carguru_{vid}"
        vehicle_ids.add(vehicle_id)

        rates = vehicle.get("rates") or []
        if not isinstance(rates, list):
            continue

        for rate in rates:
            if not isinstance(rate, dict):
                continue
            rate_title = (rate.get("title") or "").strip()
            if not rate_title:
                continue
            rate_slug = slugify(rate_title)

            drive_day = parse_money(rate.get("costDayDrivingMovement"))
            drive_night = parse_money(rate.get("costNightDrivingMovement"))
            park_day = parse_money(rate.get("costDayParking"))
            park_night = parse_money(rate.get("costNightParking"))
            km_over = parse_money(rate.get("costDayAdditionalMileage"))
            included_km = parse_int(rate.get("fixedFreeMileage"))

            # Fees / minimums (names based on observed public API variants)
            service_fee = parse_money(rate.get("costService") or rate.get("costServiceFee") or rate.get("costServicePrice"))
            reservation_fee = parse_money(
                rate.get("costReservation")
                or rate.get("costReservationFee")
                or rate.get("costReservationPrice")
                or rate.get("costReserve")
            )
            start_fee = parse_money(rate.get("costStart") or rate.get("costStartFee") or rate.get("costStartPrice"))

            # Minimum total (prefer explicit minimum if present, otherwise fall back to day/night mins)
            min_total = parse_money(rate.get("costMinimum") or rate.get("costMinimumPrice") or rate.get("costMinTotal"))
            if not min_total:
                min_day = parse_money(rate.get("costDayMin"))
                min_night = parse_money(rate.get("costNightMin"))
                try:
                    md = float(min_day) if min_day else 0.0
                    mn = float(min_night) if min_night else 0.0
                    mmax = max(md, mn)
                    min_total = f"{mmax:.2f}".rstrip("0").rstrip(".") if mmax > 0 else ""
                except Exception:
                    min_total = min_day or min_night or ""

            periods = rate.get("period") or []
            note = "Imported from CarGuru public web API; period bundles modeled as packages."

            # Special-case: CarGuru "Prepaid 24h" is priced per 24h block plus per-km, and repeats per started 24h.
            # Model it as DAILY to correctly scale the base price by ceil(total_min/1440), and to avoid adding our
            # default CarGuru service fee (the public API often omits costService for these).
            if "prepaid 24h" in rate_title.lower() and isinstance(periods, list):
                daily_cost = ""
                for p in periods:
                    if not isinstance(p, dict):
                        continue
                    if str((p.get("time") or "")).strip().lower() != "1d":
                        continue
                    daily_cost = parse_money(p.get("cost"))
                    if daily_cost:
                        break
                if daily_cost:
                    options.append(
                        OptionRow(
                            provider_id="carguru",
                            vehicle_id=vehicle_id,
                            option_id=f"{vehicle_id}_{rate_slug}_daily",
                            option_name=f"{title} — {rate_title} (24h blocks)",
                            option_type="DAILY",
                            fixed_fee_eur=service_fee or "0",
                            reservation_fee_eur=reservation_fee or "0",
                            trip_fee_eur=start_fee or "0",
                            min_total_eur=min_total,
                            drive_day_min_rate_eur=drive_day,
                            drive_night_min_rate_eur=drive_night or drive_day,
                            park_day_min_rate_eur=park_day or drive_day,
                            park_night_min_rate_eur=park_night or park_day or drive_night or drive_day,
                            km_rate_eur=km_over,
                            included_km=included_km or "0",
                            daily_price_eur=daily_cost,
                            daily_included_km="0",
                            daily_unlimited_km="FALSE",
                            daily_over_km_rate_eur=km_over,
                            fuel_included="TRUE",
                            parking_included="TRUE",
                            source_url="https://carguru.lv/article/476",
                            notes=note + " Prepaid 24h modeled as daily 24h blocks + per-km.",
                        )
                    )
                    continue

            payg = OptionRow(
                provider_id="carguru",
                vehicle_id=vehicle_id,
                option_id=f"{vehicle_id}_{rate_slug}_payg",
                option_name=f"{title} — {rate_title} (PAYG)",
                option_type="PAYG",
                fixed_fee_eur=service_fee or "0",
                reservation_fee_eur=reservation_fee or "0",
                trip_fee_eur=start_fee or "0",
                min_total_eur=min_total,
                drive_day_min_rate_eur=drive_day,
                drive_night_min_rate_eur=drive_night or drive_day,
                park_day_min_rate_eur=park_day or drive_day,
                park_night_min_rate_eur=park_night or park_day or drive_night or drive_day,
                km_rate_eur=km_over,
                included_km=included_km or "0",
                fuel_included="TRUE",
                parking_included="TRUE",
                source_url="https://carguru.lv/rates",
                notes=note,
            )
            options.append(payg)

            if isinstance(periods, list):
                for p in periods:
                    if not isinstance(p, dict):
                        continue
                    time_str = (p.get("time") or "").strip()
                    cost = parse_money(p.get("cost"))
                    if not time_str or not cost:
                        continue
                    try:
                        included_min = str(duration_to_minutes(time_str))
                    except Exception:
                        continue
                    options.append(
                        OptionRow(
                            provider_id="carguru",
                            vehicle_id=vehicle_id,
                            option_id=f"{vehicle_id}_{rate_slug}_{slugify(time_str)}",
                            option_name=f"{title} — {rate_title} ({time_str})",
                            option_type="PACKAGE",
                            fixed_fee_eur=service_fee or "0",
                            reservation_fee_eur=reservation_fee or "0",
                            trip_fee_eur=start_fee or "0",
                            drive_day_min_rate_eur=drive_day,
                            drive_night_min_rate_eur=drive_night or drive_day,
                            park_day_min_rate_eur=park_day or drive_day,
                            park_night_min_rate_eur=park_night or park_day or drive_night or drive_day,
                            km_rate_eur=km_over,
                            package_price_eur=cost,
                            included_min=included_min,
                            included_km=included_km or "0",
                            fuel_included="TRUE",
                            parking_included="TRUE",
                            source_url="https://carguru.lv/rates",
                            notes=note,
                        )
                    )

    return options, vehicle_ids


def read_tsv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        header = reader.fieldnames or []
        rows = [dict(r) for r in reader]
    return header, rows


def write_tsv(path: Path, header: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header, delimiter="\t", lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in header})


def main(argv: list[str]) -> int:
    root = Path(__file__).resolve().parents[1]
    options_path = root / "web" / "data" / "options.tsv"
    options_path.parent.mkdir(parents=True, exist_ok=True)

    header, existing_rows = read_tsv(options_path)
    if not header:
        raise RuntimeError("Options.tsv header missing")

    # Keep all existing rows except those we fully regenerate.
    keep: list[dict[str, str]] = [
        r for r in existing_rows if (r.get("provider_id") or "").strip() not in {"carguru", "citybee"}
    ]

    citybee_html = fetch_text("https://citybee.lv/lv/cenas/")
    citybee_opts, _ = parse_citybee_options_from_cenas(citybee_html)

    carguru_json = fetch_json("https://go-rest.carguru.online/public/web/rate/short")
    carguru_opts, _ = parse_carguru_options_from_rate_short(carguru_json)

    generated = [o.as_dict() for o in (citybee_opts + carguru_opts)]

    # De-dup on option_id (last wins).
    merged: dict[str, dict[str, str]] = {}
    for r in keep + generated:
        oid = (r.get("option_id") or "").strip()
        if not oid:
            continue
        merged[oid] = r

    out_rows = list(merged.values())
    out_rows.sort(key=lambda r: (r.get("provider_id", ""), r.get("vehicle_id", ""), r.get("option_type", ""), r.get("option_name", "")))
    write_tsv(options_path, header, out_rows)

    print(f"Wrote {options_path} ({len(out_rows)} options; kept {len(keep)} other-provider rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
