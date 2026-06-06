#!/usr/bin/env python3
"""Starter pipeline for Thai Customs export CSV files.

This script is intentionally conservative: it reads a CSV that was downloaded
from an official source, validates the fields expected by the dashboard, writes
an auditable raw copy, and emits a normalized CSV that the web app can import.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


REQUIRED_FIELDS = {"period", "hs_code", "country", "value_fob", "source"}
OPTIONAL_FIELDS = {"quantity", "unit", "downloaded_at", "product_description"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize Thai Customs export CSV data.")
    parser.add_argument("input_csv", type=Path, help="CSV downloaded from Customs or another official source")
    parser.add_argument("--out-dir", type=Path, default=Path("data/processed"))
    parser.add_argument("--raw-dir", type=Path, default=Path("data/raw"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    downloaded_at = datetime.now(timezone.utc).isoformat()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    args.raw_dir.mkdir(parents=True, exist_ok=True)

    content = args.input_csv.read_bytes()
    digest = hashlib.sha256(content).hexdigest()[:16]
    raw_path = args.raw_dir / f"{args.input_csv.stem}-{digest}.csv"
    raw_path.write_bytes(content)

    with args.input_csv.open(newline="", encoding="utf-8-sig") as handle:
      reader = csv.DictReader(handle)
      if not reader.fieldnames:
          raise SystemExit("CSV has no header row")
      missing = REQUIRED_FIELDS - set(reader.fieldnames)
      if missing:
          raise SystemExit(f"Missing required columns: {', '.join(sorted(missing))}")
      rows = [normalize_row(row, downloaded_at) for row in reader]

    validate_rows(rows)
    output_path = args.out_dir / "exports_normalized.csv"
    fieldnames = ["period", "hs_code", "country", "value_fob", "quantity", "unit", "source", "downloaded_at", "product_description"]
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    run_log = {
        "input": str(args.input_csv),
        "raw_copy": str(raw_path),
        "output": str(output_path),
        "row_count": len(rows),
        "sha256": hashlib.sha256(content).hexdigest(),
        "downloaded_at": downloaded_at,
    }
    (args.out_dir / "latest_run.json").write_text(json.dumps(run_log, indent=2), encoding="utf-8")
    print(json.dumps(run_log, indent=2))


def normalize_row(row: dict[str, str], downloaded_at: str) -> dict[str, str | float]:
    return {
        "period": row["period"].strip(),
        "hs_code": row["hs_code"].strip(),
        "country": row["country"].strip(),
        "value_fob": to_number(row["value_fob"]),
        "quantity": to_number(row.get("quantity", "")),
        "unit": row.get("unit", "").strip(),
        "source": row["source"].strip(),
        "downloaded_at": row.get("downloaded_at", "").strip() or downloaded_at,
        "product_description": row.get("product_description", "").strip(),
    }


def validate_rows(rows: list[dict[str, str | float]]) -> None:
    seen = set()
    for row in rows:
        key = (row["period"], row["hs_code"], row["country"])
        if key in seen:
            raise SystemExit(f"Duplicate period/hs_code/country row: {key}")
        seen.add(key)
        if not str(row["period"]).count("-") == 1:
            raise SystemExit(f"Invalid period format: {row['period']}")
        if float(row["value_fob"]) < 0:
            raise SystemExit(f"Negative value_fob for {key}")


def to_number(value: str | None) -> float:
    if value is None or value == "":
        return 0.0
    return float(str(value).replace(",", ""))


if __name__ == "__main__":
    main()
