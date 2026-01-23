from __future__ import annotations

import csv
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class VehicleRow:
    provider_id: str
    vehicle_id: str
    vehicle_name: str
    vehicle_class: str = ""


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


def read_existing_vehicles(path: Path) -> tuple[list[str], dict[tuple[str, str], VehicleRow]]:
    if not path.exists():
        return (["provider_id", "vehicle_id", "vehicle_name", "vehicle_class"], {})
    with path.open("r", encoding="utf-8") as f:
        rows = list(csv.reader(f, delimiter="\t"))
    if not rows:
        return (["provider_id", "vehicle_id", "vehicle_name", "vehicle_class"], {})
    header = rows[0]
    data: dict[tuple[str, str], VehicleRow] = {}
    for r in rows[1:]:
        if not r or len(r) < 3:
            continue
        provider_id = r[0].strip()
        vehicle_id = r[1].strip()
        vehicle_name = r[2].strip()
        vehicle_class = (r[3].strip() if len(r) >= 4 else "")
        if provider_id and vehicle_id:
            data[(provider_id, vehicle_id)] = VehicleRow(provider_id, vehicle_id, vehicle_name, vehicle_class)
    return (header, data)


def write_vehicles(path: Path, header: list[str], vehicles: list[VehicleRow]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow(header)
        for v in vehicles:
            w.writerow([v.provider_id, v.vehicle_id, v.vehicle_name, v.vehicle_class])


def main(argv: list[str]) -> int:
    root = Path(__file__).resolve().parents[1]
    vehicles_path = root / "templates" / "sheets" / "Vehicles.tsv"

    header, existing = read_existing_vehicles(vehicles_path)

    citybee_html = fetch_text("https://citybee.lv/lv/cenas/")
    citybee_vehicles = parse_citybee_vehicles_from_cenas(citybee_html)

    carguru_json = fetch_json("https://go-rest.carguru.online/public/web/rate/short")
    carguru_vehicles = parse_carguru_vehicles_from_rate_short(carguru_json)

    merged = dict(existing)
    for v in citybee_vehicles + carguru_vehicles:
        merged[(v.provider_id, v.vehicle_id)] = v

    def sort_key(v: VehicleRow) -> tuple[str, str, str]:
        return (v.provider_id, v.vehicle_class, v.vehicle_name)

    out = sorted(merged.values(), key=sort_key)
    write_vehicles(vehicles_path, header, out)

    print(f"Wrote {vehicles_path} ({len(out)} vehicles)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
