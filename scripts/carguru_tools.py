from __future__ import annotations

import argparse
import base64
import html
import json
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen


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


def decode_carguru_article_description(val_b64: str) -> tuple[str, str]:
    raw_html = base64.b64decode(val_b64).decode("utf-8", errors="replace")
    raw_html = html.unescape(raw_html)
    plain = re.sub(r"<[^>]+>", " ", raw_html)
    plain = re.sub(r"\s+", " ", plain).strip()
    return raw_html, plain


def cmd_fetch_rate_short(out_path: Path) -> int:
    obj = fetch_json("https://go-rest.carguru.online/public/web/rate/short")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


def cmd_fetch_article(article_id: str, locale: str, out_path: Path, print_plain: bool) -> int:
    url = f"https://go-rest.carguru.online/public/web/article?_id={article_id}&_locale={locale}"
    obj = fetch_json(url)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path}")

    if print_plain:
        res = obj.get("result") if isinstance(obj, dict) else None
        item = res[0] if isinstance(res, list) and res else None
        descs = item.get("descriptions") if isinstance(item, dict) else None
        if isinstance(descs, list):
            for d in descs:
                if not isinstance(d, dict):
                    continue
                val = d.get("val")
                if not isinstance(val, str) or not val.strip():
                    continue
                _, plain = decode_carguru_article_description(val)
                print(plain)
        else:
            print("(No descriptions found in article payload.)")

    return 0


def _money(s: object) -> str:
    if s is None:
        return ""
    t = str(s).strip().replace("€", "").replace("\xa0", " ")
    t = re.sub(r"\s+", "", t)
    m = re.search(r"-?\d+(?:\.\d+)?", t)
    return m.group(0) if m else ""


def cmd_report_prepaid_24h(rate_short_path: Path) -> int:
    obj = json.loads(rate_short_path.read_text(encoding="utf-8"))
    if not isinstance(obj, dict) or not obj.get("success"):
        raise SystemExit("Unexpected JSON: missing/false success")
    result = obj.get("result")
    if not isinstance(result, list):
        raise SystemExit("Unexpected JSON: result is not a list")

    rows: list[tuple[str, str, str, str, str]] = []
    for v in result:
        if not isinstance(v, dict):
            continue
        vid = str(v.get("id") or "").strip()
        vtitle = str(v.get("title") or "").strip()
        if not vid or not vtitle:
            continue
        for r in v.get("rates") or []:
            if not isinstance(r, dict):
                continue
            title = str(r.get("title") or "").strip()
            if "prepaid 24h" not in title.lower():
                continue
            km = _money(r.get("costDayAdditionalMileage"))
            period = r.get("period") or []
            day_cost = ""
            if isinstance(period, list):
                for p in period:
                    if not isinstance(p, dict):
                        continue
                    if str(p.get("time") or "").strip().lower() != "1d":
                        continue
                    day_cost = _money(p.get("cost"))
                    break
            rows.append((vid, vtitle, title, day_cost, km))

    rows.sort(key=lambda x: (x[1], x[2]))
    if not rows:
        print("No Prepaid 24h rates found in rate/short.")
        return 0

    print("CarGuru Prepaid 24h (from go-rest rate/short):")
    print("vehicle_id\tvehicle_name\ttariff\t24h_price_eur\tkm_rate_eur")
    for vid, vtitle, title, day_cost, km in rows:
        print(f"carguru_{vid}\t{vtitle}\t{title}\t{day_cost}\t{km}")
    return 0


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="Small tools for fetching/inspecting CarGuru public web API payloads.")
    sub = p.add_subparsers(dest="cmd", required=True)

    s1 = sub.add_parser("fetch-rate-short", help="Fetch /public/web/rate/short and save it as JSON.")
    s1.add_argument("--out", default="/tmp/carcalc_web/carguru_rate_short.json", help="Output JSON path.")

    s2 = sub.add_parser("fetch-article", help="Fetch /public/web/article by id/locale and save it as JSON.")
    s2.add_argument("--id", required=True, help="Article id, e.g. 476")
    s2.add_argument("--locale", default="lv", help="Locale, e.g. lv/en/ru")
    s2.add_argument("--out", default="/tmp/carcalc_web/carguru_article.json", help="Output JSON path.")
    s2.add_argument("--print-plain", action="store_true", help="Also print a text-only version of descriptions.")

    s3 = sub.add_parser("report-prepaid-24h", help="Print a table of Prepaid 24h tariffs from a saved rate/short JSON.")
    s3.add_argument("--rate-short", default="/tmp/carcalc_web/carguru_rate_short.json", help="Path to saved rate/short JSON.")

    args = p.parse_args(argv)

    if args.cmd == "fetch-rate-short":
        return cmd_fetch_rate_short(Path(args.out))
    if args.cmd == "fetch-article":
        return cmd_fetch_article(args.id, args.locale, Path(args.out), args.print_plain)
    if args.cmd == "report-prepaid-24h":
        return cmd_report_prepaid_24h(Path(args.rate_short))
    raise SystemExit(f"Unknown cmd: {args.cmd}")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

