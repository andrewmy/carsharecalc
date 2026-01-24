from __future__ import annotations

import argparse
import csv
import re
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Vehicle:
    provider_id: str
    vehicle_id: str
    vehicle_name: str
    vehicle_class: str
    fuel_type_raw: str
    consumption_raw: str
    consumption_source_url: str
    snowboard_source_url: str

    @property
    def key(self) -> tuple[str, str]:
        return (self.provider_id, self.vehicle_id)

    @property
    def fuel_type(self) -> str | None:
        v = (self.fuel_type_raw or "").strip().lower()
        if v in {"petrol", "diesel", "ev"}:
            return v
        if v == "":
            return None
        return None

    @property
    def fuel_type_is_invalid(self) -> bool:
        v = (self.fuel_type_raw or "").strip().lower()
        return v not in {"", "petrol", "diesel", "ev"}

    @property
    def consumption(self) -> float | None:
        s = (self.consumption_raw or "").strip()
        if s == "":
            return None
        try:
            n = float(s)
        except ValueError:
            return None
        return n if n > 0 else None

    @property
    def consumption_is_invalid(self) -> bool:
        s = (self.consumption_raw or "").strip()
        if s == "":
            return False
        try:
            n = float(s)
        except ValueError:
            return True
        return not (n > 0)


def read_vehicles(path: Path) -> tuple[list[str], list[Vehicle]]:
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        header = list(reader.fieldnames or [])
        vehicles: list[Vehicle] = []
        for r in reader:
            vehicles.append(
                Vehicle(
                    provider_id=(r.get("provider_id") or "").strip(),
                    vehicle_id=(r.get("vehicle_id") or "").strip(),
                    vehicle_name=(r.get("vehicle_name") or "").strip(),
                    vehicle_class=(r.get("vehicle_class") or "").strip(),
                    fuel_type_raw=(r.get("fuel_type") or "").strip(),
                    consumption_raw=(r.get("consumption_l_per_100km_default") or "").strip(),
                    consumption_source_url=(r.get("consumption_source_url") or "").strip(),
                    snowboard_source_url=(r.get("snowboard_source_url") or "").strip(),
                )
            )
    return header, vehicles


def norm_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def format_vehicle_line(v: Vehicle) -> str:
    cls = f" ({v.vehicle_class})" if v.vehicle_class else ""
    ft = (v.fuel_type_raw or "").strip() or "—"
    cons = (v.consumption_raw or "").strip() or "—"
    return f"- `{v.provider_id}` / `{v.vehicle_id}` — {v.vehicle_name}{cls} (fuel_type={ft}, consumption={cons})"


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Print a PR-ready checklist of vehicles missing fuel metadata "
            "(fuel_type and/or consumption_l_per_100km_default)."
        )
    )
    ap.add_argument(
        "--path",
        default=str(Path(__file__).resolve().parents[1] / "web" / "data" / "vehicles.tsv"),
        help="Path to vehicles.tsv (default: ./web/data/vehicles.tsv)",
    )
    args = ap.parse_args(argv)

    path = Path(args.path)
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        return 2

    header, vehicles = read_vehicles(path)
    missing_cols = [
        c
        for c in (
            "provider_id",
            "vehicle_id",
            "vehicle_name",
            "vehicle_class",
            "fuel_type",
            "consumption_l_per_100km_default",
            "consumption_source_url",
        )
        if c not in header
    ]
    if missing_cols:
        print(f"Missing expected columns in header: {', '.join(missing_cols)}", file=sys.stderr)
        return 2

    invalid_fuel = [v for v in vehicles if v.fuel_type_is_invalid]
    invalid_cons = [v for v in vehicles if v.consumption_is_invalid]
    missing_fuel_type = [v for v in vehicles if v.fuel_type is None and (v.fuel_type_raw or "").strip() == ""]

    needs_consumption = [
        v
        for v in vehicles
        if (v.fuel_type or "").strip() != "ev" and v.consumption is None and (v.consumption_raw or "").strip() == ""
    ]

    by_name: dict[str, list[Vehicle]] = {}
    for v in vehicles:
        name_key = norm_spaces(v.vehicle_name)
        if not name_key:
            continue
        by_name.setdefault(name_key, []).append(v)

    copy_candidates: list[tuple[str, list[Vehicle], list[Vehicle]]] = []
    for name, group in by_name.items():
        filled = [v for v in group if v.consumption is not None]
        blank = [v for v in group if v.consumption is None and (v.consumption_raw or "").strip() == ""]
        if filled and blank:
            copy_candidates.append((name, filled, blank))
    copy_candidates.sort(key=lambda t: t[0].lower())

    print("### Fuel consumption metadata checklist")
    print()
    print(f"- File: `{path}`")
    print(f"- Rows: {len(vehicles)}")
    print(f"- Missing `fuel_type`: {len(missing_fuel_type)}")
    print(f"- Missing consumption (non-EV): {len(needs_consumption)}")
    if invalid_fuel:
        print(f"- Invalid `fuel_type` values: {len(invalid_fuel)} (should be petrol/diesel/ev/blank)")
    if invalid_cons:
        print(f"- Invalid `consumption_l_per_100km_default` values: {len(invalid_cons)} (should be >0/blank)")
    print()

    if missing_fuel_type:
        print("#### Missing `fuel_type`")
        for v in sorted(missing_fuel_type, key=lambda x: (x.provider_id, x.vehicle_class, x.vehicle_name, x.vehicle_id)):
            print(format_vehicle_line(v))
        print()

    if needs_consumption:
        print("#### Missing consumption (non-EV)")
        print("- Use `consumption_source_url` when possible (can reuse `snowboard_source_url` if it has specs).")
        print("- Default fallback in-app is `8` L/100km when blank.")
        for v in sorted(needs_consumption, key=lambda x: (x.provider_id, x.vehicle_class, x.vehicle_name, x.vehicle_id)):
            print(format_vehicle_line(v))
            if v.consumption_source_url:
                print(f"  - consumption source: {v.consumption_source_url}")
            elif v.snowboard_source_url:
                print(f"  - suggested source: {v.snowboard_source_url}")
        print()

    if copy_candidates:
        print("#### Exact-name copy candidates (optional)")
        print("- These have the same `vehicle_name` and already have a consumption value elsewhere in the file.")
        print("- You can often copy the value+source to the blank rows after sanity-checking it’s the same model/engine.")
        for name, filled, blank in copy_candidates:
            filled_vals = ", ".join(sorted({(vv.consumption_raw or "").strip() for vv in filled if (vv.consumption_raw or "").strip()}))
            print(f"- {name} — filled: {filled_vals} (copy to {len(blank)} blank row(s))")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

