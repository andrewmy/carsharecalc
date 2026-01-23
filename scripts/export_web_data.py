from __future__ import annotations

import shutil
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    src_dir = root / "templates" / "sheets"
    dst_dir = root / "web" / "data"
    dst_dir.mkdir(parents=True, exist_ok=True)

    for name in ["Providers.tsv", "Vehicles.tsv", "Options.tsv"]:
        shutil.copyfile(src_dir / name, dst_dir / name.lower())

    print(f"Wrote {dst_dir}/providers.tsv, vehicles.tsv, options.tsv")


if __name__ == "__main__":
    main()

