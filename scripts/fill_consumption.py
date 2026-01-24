from __future__ import annotations

import argparse
import csv
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse


DEFAULT_FALLBACK_L_PER_100KM = 8.0
UK_MPG_TO_L_PER_100KM = 282.480936  # 100 km / miles-per-gallon (UK/imperial)


@dataclass
class Update:
    provider_id: str
    vehicle_id: str
    field: str
    old: str
    new: str


def fetch_text(url: str) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (carsharecalc import script)",
            "Accept": "text/html,application/json",
        },
    )
    with urlopen(req, timeout=30) as resp:
        data = resp.read()
    return data.decode("utf-8", errors="ignore")


def infer_fuel_type(vehicle_name: str, vehicle_id: str) -> str:
    hay = f"{vehicle_name} {vehicle_id}".strip().lower()
    if "diesel" in hay:
        return "diesel"
    # Treat hybrids as petrol.
    if "hybrid" in hay or "e-power" in hay or "epower" in hay or "phev" in hay:
        return "petrol"
    if "tesla" in hay or "electric" in hay or re.search(r"\bev\b", hay):
        return "ev"
    return "petrol"


def parse_carwow_mpg_range(html: str) -> tuple[float, float] | None:
    # Prefer the structured “at-a-glance” block for Fuel economy.
    m = re.search(
        r"Fuel economy.*?<span>\s*([0-9]{2,3}(?:\.[0-9])?)\s*-\s*([0-9]{2,3}(?:\.[0-9])?)\s*mpg\s*</span>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        lo, hi = (a, b) if a <= b else (b, a)
        return (lo, hi)

    # Fallback: any mpg range on the page (less precise, but still sourced).
    m2 = re.search(
        r"\b([0-9]{2,3}(?:\.[0-9])?)\s*-\s*([0-9]{2,3}(?:\.[0-9])?)\s*mpg\b",
        html,
        re.IGNORECASE,
    )
    if m2:
        a, b = float(m2.group(1)), float(m2.group(2))
        lo, hi = (a, b) if a <= b else (b, a)
        return (lo, hi)

    # Fallback: single mpg value in the at-a-glance block.
    m3 = re.search(r"Fuel economy.*?<span>\s*([0-9]{2,3}(?:\.[0-9])?)\s*mpg\s*</span>", html, re.IGNORECASE | re.DOTALL)
    if m3:
        v = float(m3.group(1))
        return (v, v)

    return None


def mpg_to_l_per_100km(mpg_uk: float) -> float:
    if mpg_uk <= 0:
        return 0.0
    return UK_MPG_TO_L_PER_100KM / mpg_uk


def compute_estimate_from_range(mpg_lo: float, mpg_hi: float) -> float:
    """
    Produce a single worst-case estimate.

    Carwow gives a range across versions; we pick the less efficient end (lower mpg),
    which yields the highest L/100km (i.e., worst fuel cost) to avoid underestimating.
    """
    return mpg_to_l_per_100km(mpg_lo)


def read_tsv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        header = list(reader.fieldnames or [])
        rows: list[dict[str, str]] = []
        for r in reader:
            rows.append({k: (v or "") for k, v in r.items()})
    return header, rows


def write_tsv(path: Path, header: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header, delimiter="\t", lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in header})


def ensure_columns(header: list[str], cols: list[str]) -> list[str]:
    out = list(header)
    for c in cols:
        if c not in out:
            out.append(c)
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Fill vehicles.tsv fuel metadata (fuel_type + consumption_l_per_100km_default) from known sources.\n"
            "Currently supports Carwow model pages by converting their displayed MPG range."
        )
    )
    ap.add_argument(
        "--path",
        default=str(Path(__file__).resolve().parents[1] / "web" / "data" / "vehicles.tsv"),
        help="Path to vehicles.tsv (default: ./web/data/vehicles.tsv)",
    )
    ap.add_argument("--apply", action="store_true", help="Write changes to vehicles.tsv. Otherwise, dry-run prints a summary.")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing non-empty fuel_type/consumption values.")
    ap.add_argument("--limit", type=int, default=0, help="If >0, limit network fetches to first N eligible rows.")
    args = ap.parse_args(argv)

    path = Path(args.path)
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        return 2

    header, rows = read_tsv(path)
    header = ensure_columns(
        header,
        [
            "fuel_type",
            "consumption_l_per_100km_default",
            "consumption_source_url",
        ],
    )

    updates: list[Update] = []
    fetches = 0

    for r in rows:
        provider_id = (r.get("provider_id") or "").strip()
        vehicle_id = (r.get("vehicle_id") or "").strip()
        vehicle_name = (r.get("vehicle_name") or "").strip()
        if not provider_id or not vehicle_id:
            continue

        current_fuel = (r.get("fuel_type") or "").strip()
        if args.overwrite or current_fuel == "":
            inferred = infer_fuel_type(vehicle_name, vehicle_id)
            if inferred != current_fuel:
                updates.append(Update(provider_id, vehicle_id, "fuel_type", current_fuel, inferred))
                r["fuel_type"] = inferred

        fuel_type = (r.get("fuel_type") or "").strip().lower() or infer_fuel_type(vehicle_name, vehicle_id)
        if fuel_type == "ev":
            continue

        current_cons = (r.get("consumption_l_per_100km_default") or "").strip()
        if not (args.overwrite or current_cons == ""):
            continue

        url = (r.get("consumption_source_url") or "").strip() or (r.get("snowboard_source_url") or "").strip()
        if not url:
            continue

        host = (urlparse(url).hostname or "").lower()
        if host.endswith("carwow.co.uk"):
            if args.limit and fetches >= args.limit:
                continue
            fetches += 1
            try:
                html = fetch_text(url)
            except Exception as e:
                print(f"WARN: failed to fetch {provider_id}/{vehicle_id} {url}: {e}", file=sys.stderr)
                continue

            mpg_range = parse_carwow_mpg_range(html)
            if not mpg_range:
                print(f"WARN: could not parse mpg for {provider_id}/{vehicle_id} {url}", file=sys.stderr)
                continue

            mpg_lo, mpg_hi = mpg_range
            est = compute_estimate_from_range(mpg_lo, mpg_hi)
            if est <= 0:
                continue
            est_rounded = round(est, 1)
            new_cons = f"{est_rounded:.1f}".rstrip("0").rstrip(".") if est_rounded % 1 else str(int(est_rounded))

            if new_cons != current_cons:
                updates.append(Update(provider_id, vehicle_id, "consumption_l_per_100km_default", current_cons, new_cons))
                r["consumption_l_per_100km_default"] = new_cons

            current_source = (r.get("consumption_source_url") or "").strip()
            if args.overwrite or current_source == "":
                if url != current_source:
                    updates.append(Update(provider_id, vehicle_id, "consumption_source_url", current_source, url))
                    r["consumption_source_url"] = url

    changed_keys = {(u.provider_id, u.vehicle_id) for u in updates}
    print(f"File: {path}")
    print(f"Rows: {len(rows)}")
    print(f"Eligible fetches attempted: {fetches}")
    print(f"Vehicles touched: {len(changed_keys)}")
    print(f"Field updates: {len(updates)}")
    if not updates:
        return 0

    by_field: dict[str, int] = {}
    for u in updates:
        by_field[u.field] = by_field.get(u.field, 0) + 1
    print("Updates by field:", ", ".join(f"{k}={v}" for k, v in sorted(by_field.items())))

    if not args.apply:
        print("\nDry-run. Re-run with --apply to write changes.")
        return 0

    write_tsv(path, header, rows)
    print("Wrote changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
