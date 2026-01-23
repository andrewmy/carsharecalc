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
    snowboard_ok_raw: str
    snowboard_source_url: str

    @property
    def snowboard_ok(self) -> bool | None:
        v = self.snowboard_ok_raw.strip().upper()
        if v == "":
            return None
        if v == "TRUE":
            return True
        if v == "FALSE":
            return False
        return None

    @property
    def snowboard_ok_is_invalid(self) -> bool:
        v = self.snowboard_ok_raw.strip().upper()
        return v not in {"", "TRUE", "FALSE"}

    @property
    def key(self) -> tuple[str, str]:
        return (self.provider_id, self.vehicle_id)


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
                    snowboard_ok_raw=(r.get("snowboard_ok") or "").strip(),
                    snowboard_source_url=(r.get("snowboard_source_url") or "").strip(),
                )
            )
    return header, vehicles


def norm_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def format_vehicle_line(v: Vehicle) -> str:
    cls = f" ({v.vehicle_class})" if v.vehicle_class else ""
    return f"- `{v.provider_id}` / `{v.vehicle_id}` — {v.vehicle_name}{cls}"


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description="Print a PR-ready checklist of vehicles missing snowboard metadata (snowboard_ok blank)."
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
    missing_cols = [c for c in ("provider_id", "vehicle_id", "vehicle_name", "vehicle_class", "snowboard_ok", "snowboard_source_url") if c not in header]
    if missing_cols:
        print(f"Missing expected columns in header: {', '.join(missing_cols)}", file=sys.stderr)
        return 2

    invalid = [v for v in vehicles if v.snowboard_ok_is_invalid]
    needs_research = [v for v in vehicles if v.snowboard_ok is None and v.snowboard_ok_raw.strip() == ""]

    by_name: dict[str, list[Vehicle]] = {}
    for v in vehicles:
        name_key = norm_spaces(v.vehicle_name)
        if not name_key:
            continue
        by_name.setdefault(name_key, []).append(v)

    # Exact-name copy candidates: same vehicle_name, at least one TRUE/FALSE and at least one blank.
    copy_candidates: list[tuple[str, list[Vehicle], list[Vehicle]]] = []
    for name, group in by_name.items():
        filled = [v for v in group if v.snowboard_ok_raw.strip().upper() in {"TRUE", "FALSE"}]
        blank = [v for v in group if v.snowboard_ok_raw.strip() == ""]
        if filled and blank:
            copy_candidates.append((name, filled, blank))
    copy_candidates.sort(key=lambda t: t[0].lower())

    print("### Snowboard metadata checklist")
    print()
    print(f"- File: `{path}`")
    print(f"- Rows: {len(vehicles)}")
    print(f"- Needs research (`snowboard_ok` blank): {len(needs_research)}")
    if invalid:
        print(f"- Invalid `snowboard_ok` values: {len(invalid)} (should be TRUE/FALSE/blank)")
    print()

    if needs_research:
        print("#### Needs research")
        for v in sorted(needs_research, key=lambda x: (x.provider_id, x.vehicle_class, x.vehicle_name, x.vehicle_id)):
            print(format_vehicle_line(v))
        print()

    if copy_candidates:
        print("#### Exact-name copy candidates (optional)")
        print("- These have the same `vehicle_name` and already have a TRUE/FALSE elsewhere in the file.")
        print("- You can often copy the existing value+URL to the blank rows after sanity-checking they’re the same model.")
        print()
        for name, filled, blank in copy_candidates:
            print(f"- {name}")
            for v in filled:
                print(f"  - source: `{v.provider_id}` / `{v.vehicle_id}` → `{v.snowboard_ok_raw.strip().upper()}` ({v.snowboard_source_url or 'no url'})")
            for v in blank:
                print(f"  - target: `{v.provider_id}` / `{v.vehicle_id}` (blank)")
        print()

    if invalid:
        print("#### Invalid values")
        for v in sorted(invalid, key=lambda x: (x.provider_id, x.vehicle_id)):
            print(f"- `{v.provider_id}` / `{v.vehicle_id}` — snowboard_ok={v.snowboard_ok_raw!r}")
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

