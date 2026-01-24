from __future__ import annotations

import argparse
import csv
import re
import sys
from dataclasses import dataclass
from pathlib import Path


DEFAULT_VEHICLES_PATH = Path(__file__).resolve().parents[1] / "web" / "data" / "vehicles.tsv"
DEFAULT_OPTIONS_PATH = Path(__file__).resolve().parents[1] / "web" / "data" / "options.tsv"


def _detect_preferred_newline(path: Path) -> str:
    b = path.read_bytes()
    crlf = b.count(b"\r\n")
    lf = b.count(b"\n")
    if lf == 0:
        return "\n"
    # If most newlines are CRLF, keep CRLF.
    if crlf >= (lf * 0.6):
        return "\r\n"
    return "\n"


def _read_text_keep_newlines(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return f.read().splitlines(True)


def _write_text_keep_newlines(path: Path, lines: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        f.write("".join(lines))


@dataclass(frozen=True)
class Tsv:
    header: list[str]
    rows: list[dict[str, str]]


def read_tsv(path: Path) -> Tsv:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        header = list(reader.fieldnames or [])
        rows: list[dict[str, str]] = []
        for r in reader:
            rows.append({k: (v or "") for k, v in r.items()})
    return Tsv(header=header, rows=rows)


def format_tsv_row(header: list[str], row: dict[str, str]) -> str:
    return "\t".join((row.get(c) or "") for c in header)


def normalize_vehicle_id(s: str) -> str:
    s = s.strip()
    if not s:
        return ""
    if not re.fullmatch(r"[a-z0-9_]+", s):
        raise ValueError(f"Invalid vehicle_id: {s!r} (expected [a-z0-9_]+)")
    return s


def normalize_snowboard_fit(s: str) -> str:
    v = (s or "").strip()
    if v == "":
        return ""
    if v in {"0", "1", "2"}:
        return v
    raise ValueError("snowboard_fit must be 0/1/2/blank")


def replace_as_of(notes: str, as_of: str) -> str:
    s = (notes or "").strip()
    if not s:
        return f"as seen in-app on {as_of}"
    s = re.sub(r"as seen in-app on \d{4}-\d{2}-\d{2}", f"as seen in-app on {as_of}", s)
    if f"as seen in-app on {as_of}" not in s:
        s = f"{s}; as seen in-app on {as_of}"
    return s


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Clone all Bolt options rows from one vehicle (tier representative) to another, "
            "optionally overriding PAYG fields (minute/km/min/cap) and inserting the new rows into the TSVs."
        )
    )
    ap.add_argument("--from-vehicle-id", required=True, help="Source Bolt vehicle_id (tier representative).")
    ap.add_argument("--to-vehicle-id", required=True, help="New Bolt vehicle_id to create.")
    ap.add_argument("--to-vehicle-name", required=True, help="Human-readable name (for vehicles.tsv and PAYG option_name).")
    ap.add_argument("--vehicles", default=str(DEFAULT_VEHICLES_PATH), help="Path to vehicles.tsv (default: ./web/data/vehicles.tsv)")
    ap.add_argument("--options", default=str(DEFAULT_OPTIONS_PATH), help="Path to options.tsv (default: ./web/data/options.tsv)")
    ap.add_argument("--apply", action="store_true", help="If set, write changes into TSVs. Otherwise, print TSV snippets to paste.")

    ap.add_argument("--vehicle-class", default="", help="Optional vehicle_class for vehicles.tsv")
    ap.add_argument(
        "--snowboard-fit",
        default="",
        help="vehicles.tsv snowboard_fit (0/1/2/blank). Baseline: ~163cm bulky bag with boots; front passenger usable.",
    )
    ap.add_argument("--snowboard-source-url", default="", help="vehicles.tsv snowboard_source_url (optional)")
    ap.add_argument("--fuel-type", default="", help="vehicles.tsv fuel_type (petrol/diesel/ev/blank). Hybrids treated as petrol.")
    ap.add_argument("--consumption", default="", help="vehicles.tsv consumption_l_per_100km_default (number/blank). EVs should be blank.")
    ap.add_argument("--consumption-source-url", default="", help="vehicles.tsv consumption_source_url (optional)")

    ap.add_argument("--as-of", default="", help="If set (YYYY-MM-DD), updates/annotates notes with this date.")
    ap.add_argument("--skip", action="append", default=[], help="Skip cloning a specific option_id from the source (repeatable).")

    # Common PAYG overrides. If set, they apply to ALL cloned rows to keep overage modeling consistent.
    ap.add_argument("--minute-rate", default="", help="Override minute rates (sets drive/park day+night rates).")
    ap.add_argument("--km-rate", default="", help="Override km_rate_eur (and over_km_rate_eur when blank).")
    ap.add_argument("--min-total", default="", help="Override min_total_eur (PAYG only).")
    ap.add_argument("--cap-24h", default="", help="Override cap_24h_eur (PAYG only).")
    ap.add_argument("--airport-fee", default="", help="Override airport_fee_eur.")

    args = ap.parse_args(argv)

    vehicles_path = Path(args.vehicles)
    options_path = Path(args.options)
    if not vehicles_path.exists():
        print(f"File not found: {vehicles_path}", file=sys.stderr)
        return 2
    if not options_path.exists():
        print(f"File not found: {options_path}", file=sys.stderr)
        return 2

    from_vehicle_id = normalize_vehicle_id(args.from_vehicle_id)
    to_vehicle_id = normalize_vehicle_id(args.to_vehicle_id)
    if from_vehicle_id == to_vehicle_id:
        print("--from-vehicle-id and --to-vehicle-id must differ.", file=sys.stderr)
        return 2

    to_vehicle_name = (args.to_vehicle_name or "").strip()
    if not to_vehicle_name:
        print("--to-vehicle-name must be non-empty.", file=sys.stderr)
        return 2

    snowboard_fit = normalize_snowboard_fit(args.snowboard_fit)
    vehicle_class = (args.vehicle_class or "").strip()
    snowboard_source_url = (args.snowboard_source_url or "").strip()
    fuel_type = (args.fuel_type or "").strip().lower()
    if fuel_type not in {"", "petrol", "diesel", "ev"}:
        print("--fuel-type must be petrol/diesel/ev/blank", file=sys.stderr)
        return 2
    consumption = (args.consumption or "").strip()
    if consumption != "":
        try:
            n = float(consumption)
        except ValueError:
            print("--consumption must be a number or blank", file=sys.stderr)
            return 2
        if not (n > 0):
            print("--consumption must be > 0 or blank", file=sys.stderr)
            return 2
    consumption_source_url = (args.consumption_source_url or "").strip()

    vehicles = read_tsv(vehicles_path)
    options = read_tsv(options_path)

    for col in (
        "provider_id",
        "vehicle_id",
        "vehicle_name",
        "vehicle_class",
        "snowboard_fit",
        "snowboard_source_url",
        "fuel_type",
        "consumption_l_per_100km_default",
        "consumption_source_url",
    ):
        if col not in vehicles.header:
            print(f"vehicles.tsv missing expected column: {col}", file=sys.stderr)
            return 2
    for col in ("provider_id", "vehicle_id", "option_id", "option_name", "option_type"):
        if col not in options.header:
            print(f"options.tsv missing expected column: {col}", file=sys.stderr)
            return 2

    existing_vehicle_ids = {
        ((r.get("provider_id") or "").strip(), (r.get("vehicle_id") or "").strip()) for r in vehicles.rows
    }
    if ("bolt", to_vehicle_id) in existing_vehicle_ids:
        print(f"vehicles.tsv already has bolt/{to_vehicle_id}", file=sys.stderr)
        return 2

    source_rows = [
        r
        for r in options.rows
        if (r.get("provider_id") or "").strip() == "bolt" and (r.get("vehicle_id") or "").strip() == from_vehicle_id
    ]
    if not source_rows:
        print(f"No Bolt option rows found for --from-vehicle-id={from_vehicle_id!r}", file=sys.stderr)
        return 2

    skip_ids = set((s or "").strip() for s in args.skip)
    if "" in skip_ids:
        skip_ids.remove("")

    existing_option_ids = set((r.get("option_id") or "").strip() for r in options.rows)

    cloned_rows: list[dict[str, str]] = []
    prefix = f"{from_vehicle_id}_"
    for r in source_rows:
        option_id = (r.get("option_id") or "").strip()
        if option_id in skip_ids:
            continue

        new = dict(r)
        new["vehicle_id"] = to_vehicle_id

        if option_id.startswith(prefix):
            new["option_id"] = f"{to_vehicle_id}_{option_id[len(prefix):]}"
        else:
            # Fallback: preserve suffix-ish ids, but still ensure uniqueness.
            new["option_id"] = f"{to_vehicle_id}_{option_id}"

        if new["option_id"] in existing_option_ids:
            print(f"options.tsv already has option_id={new['option_id']!r}", file=sys.stderr)
            return 2

        option_type = (new.get("option_type") or "").strip().upper()
        if option_type == "PAYG":
            new["option_name"] = f"PAYG ({to_vehicle_name})"
            if args.min_total != "":
                new["min_total_eur"] = args.min_total
            if args.cap_24h != "":
                new["cap_24h_eur"] = args.cap_24h

        if args.airport_fee != "":
            new["airport_fee_eur"] = args.airport_fee

        if args.minute_rate != "":
            new["drive_day_min_rate_eur"] = args.minute_rate
            new["drive_night_min_rate_eur"] = args.minute_rate
            new["park_day_min_rate_eur"] = args.minute_rate
            new["park_night_min_rate_eur"] = args.minute_rate

        if args.km_rate != "":
            new["km_rate_eur"] = args.km_rate
            # Keep over_km_rate_eur blank unless it was already set.
            if (new.get("over_km_rate_eur") or "").strip() == "":
                new["over_km_rate_eur"] = ""

        if args.as_of:
            new["notes"] = replace_as_of(new.get("notes") or "", args.as_of)
            if f"cloned from {from_vehicle_id}" not in new["notes"].lower():
                new["notes"] = f"{new['notes']}; cloned from {from_vehicle_id}"

        cloned_rows.append(new)
        existing_option_ids.add(new["option_id"])

    if not cloned_rows:
        print("No rows to clone (all source rows were skipped?).", file=sys.stderr)
        return 2

    new_vehicle_row = {c: "" for c in vehicles.header}
    new_vehicle_row.update(
        {
            "provider_id": "bolt",
            "vehicle_id": to_vehicle_id,
            "vehicle_name": to_vehicle_name,
            "vehicle_class": vehicle_class,
            "snowboard_fit": snowboard_fit,
            "snowboard_source_url": snowboard_source_url,
            "fuel_type": fuel_type,
            "consumption_l_per_100km_default": consumption,
            "consumption_source_url": consumption_source_url,
        }
    )

    vehicle_line = format_tsv_row(vehicles.header, new_vehicle_row)
    option_lines = [format_tsv_row(options.header, r) for r in cloned_rows]

    if not args.apply:
        print("# Paste into web/data/vehicles.tsv")
        print(vehicle_line)
        print()
        print("# Paste into web/data/options.tsv")
        for line in option_lines:
            print(line)
        return 0

    # Apply: insert vehicles row after last bolt row, and option rows after last bolt option row.
    # Preserve mixed newline style by keeping original newlines and only adding new lines with a preferred newline.
    vehicles_lines = _read_text_keep_newlines(vehicles_path)
    vehicles_nl = _detect_preferred_newline(vehicles_path)
    if not vehicles_lines:
        print(f"Unexpected empty file: {vehicles_path}", file=sys.stderr)
        return 2
    vehicles_insert_at = 1
    for i in range(1, len(vehicles_lines)):
        if vehicles_lines[i].startswith("bolt\t"):
            vehicles_insert_at = i + 1
    vehicles_lines.insert(vehicles_insert_at, vehicle_line + vehicles_nl)
    _write_text_keep_newlines(vehicles_path, vehicles_lines)

    options_lines = _read_text_keep_newlines(options_path)
    options_nl = _detect_preferred_newline(options_path)
    if not options_lines:
        print(f"Unexpected empty file: {options_path}", file=sys.stderr)
        return 2
    options_insert_at = 1
    for i in range(1, len(options_lines)):
        # Find the end of the Bolt block (Bolt rows are contiguous near the top in this repo).
        if options_lines[i].startswith("bolt\t"):
            options_insert_at = i + 1
        elif options_insert_at > 1:
            break

    for j, line in enumerate(option_lines):
        options_lines.insert(options_insert_at + j, line + options_nl)
    _write_text_keep_newlines(options_path, options_lines)

    print(f"Inserted 1 vehicle row into {vehicles_path}")
    print(f"Inserted {len(option_lines)} option rows into {options_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
