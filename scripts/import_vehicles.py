from __future__ import annotations

import csv
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen


DEFAULT_VEHICLES_HEADER = [
    "provider_id",
    "vehicle_id",
    "vehicle_name",
    "vehicle_class",
    "snowboard_ok",
    "snowboard_source_url",
]


@dataclass(frozen=True)
class VehicleRow:
    provider_id: str
    vehicle_id: str
    vehicle_name: str
    vehicle_class: str = ""

    def as_dict(self) -> dict[str, str]:
        return {
            "provider_id": self.provider_id,
            "vehicle_id": self.vehicle_id,
            "vehicle_name": self.vehicle_name,
            "vehicle_class": self.vehicle_class,
        }


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
    import json

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
    return s or "vehicle"


def parse_citybee_vehicles_from_cenas(html: str) -> list[VehicleRow]:
    # Extract the <select class="js-car-chooser">…</select> block
    m = re.search(r'<select[^>]*class="js-car-chooser"[^>]*>.*?</select>', html, re.DOTALL)
    if not m:
        raise RuntimeError("CityBee: could not find <select class=\"js-car-chooser\"> block")
    select_html = m.group(0)

    vehicles: list[VehicleRow] = []
    for opt in re.finditer(r"<option\s+[^>]*>\s*([^<]+?)\s*</option>", select_html, re.DOTALL):
        option_tag = opt.group(0)
        name = opt.group(1).strip()

        id_m = re.search(r'\bvalue="(\d+)"', option_tag)
        cat_m = re.search(r'\bdata-category="([^"]+)"', option_tag)
        if not id_m:
            continue
        value_id = id_m.group(1)
        category = (cat_m.group(1) if cat_m else "").strip()

        vehicles.append(
            VehicleRow(
                provider_id="citybee",
                vehicle_id=f"citybee_{value_id}",
                vehicle_name=name,
                vehicle_class=category,
            )
        )

    # Deduplicate by vehicle_id (value id)
    uniq: dict[str, VehicleRow] = {v.vehicle_id: v for v in vehicles}
    return list(uniq.values())


def parse_carguru_vehicles_from_rate_short(obj: object) -> list[VehicleRow]:
    if not isinstance(obj, dict) or "result" not in obj:
        raise RuntimeError("CarGuru: unexpected JSON shape (missing 'result')")
    result = obj["result"]
    if not isinstance(result, list):
        raise RuntimeError("CarGuru: unexpected JSON shape ('result' not a list)")

    vehicles: list[VehicleRow] = []
    for v in result:
        if not isinstance(v, dict):
            continue
        vid = v.get("id")
        title = v.get("title") or ""
        if vid is None or not title:
            continue
        vehicles.append(
            VehicleRow(
                provider_id="carguru",
                vehicle_id=f"carguru_{vid}",
                vehicle_name=str(title).strip(),
                vehicle_class="",
            )
        )
    return vehicles


def read_existing_vehicles(path: Path) -> tuple[list[str], dict[tuple[str, str], dict[str, str]]]:
    if not path.exists():
        return (list(DEFAULT_VEHICLES_HEADER), {})

    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        header = list(reader.fieldnames or [])

        # Preserve any existing columns, but ensure known columns exist (append-only).
        for col in DEFAULT_VEHICLES_HEADER:
            if col not in header:
                header.append(col)

        data: dict[tuple[str, str], dict[str, str]] = {}
        for r in reader:
            provider_id = (r.get("provider_id") or "").strip()
            vehicle_id = (r.get("vehicle_id") or "").strip()
            if not provider_id or not vehicle_id:
                continue
            data[(provider_id, vehicle_id)] = dict(r)

    return (header, data)


def write_vehicles(path: Path, header: list[str], vehicles: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header, delimiter="\t", lineterminator="\n")
        w.writeheader()
        for v in vehicles:
            w.writerow({k: v.get(k, "") for k in header})


def main(argv: list[str]) -> int:
    root = Path(__file__).resolve().parents[1]
    vehicles_path = root / "web" / "data" / "vehicles.tsv"
    vehicles_path.parent.mkdir(parents=True, exist_ok=True)

    header, existing = read_existing_vehicles(vehicles_path)

    citybee_html = fetch_text("https://citybee.lv/lv/cenas/")
    citybee_vehicles = parse_citybee_vehicles_from_cenas(citybee_html)

    carguru_json = fetch_json("https://go-rest.carguru.online/public/web/rate/short")
    carguru_vehicles = parse_carguru_vehicles_from_rate_short(carguru_json)

    merged = dict(existing)
    for v in citybee_vehicles + carguru_vehicles:
        key = (v.provider_id, v.vehicle_id)
        prev = merged.get(key, {})
        merged[key] = {**prev, **v.as_dict()}

    def sort_key(v: dict[str, str]) -> tuple[str, str, str]:
        return (v.get("provider_id", ""), v.get("vehicle_class", ""), v.get("vehicle_name", ""))

    out = sorted(merged.values(), key=sort_key)
    write_vehicles(vehicles_path, header, out)

    print(f"Wrote {vehicles_path} ({len(out)} vehicles; preserved extra columns)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
