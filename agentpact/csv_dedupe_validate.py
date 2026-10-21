#!/usr/bin/env python3
"""Dedupe and validate an order CSV: stdlib only.

Removes exact duplicate rows keyed on order_id (first occurrence wins), then
flags rows that are missing a required field. Output is written as JSON plus a
clean CSV so the caller can diff input against result.

Usage:
    python csv_dedupe_validate.py input.csv --out clean.csv --report report.json
"""
import argparse
import csv
import json
import sys

REQUIRED = ("order_id", "customer_email", "amount", "date")


def dedupe(rows, key="order_id"):
    """Return (kept, dropped) as (row, source_line) pairs. First row per key wins.

    source_line is the 1-based line in the original file, so the header is line 1
    and the first data row is line 2.
    """
    kept, dropped, seen = [], [], set()
    for offset, row in enumerate(rows, start=2):
        k = (row.get(key) or "").strip()
        if k and k in seen:
            dropped.append((row, offset))
            continue
        if k:
            seen.add(k)
        kept.append((row, offset))
    return kept, dropped


def validate(rows):
    """Return issue dicts for missing required values, keyed by source line."""
    issues = []
    for row, line in rows:
        for field in REQUIRED:
            if not (row.get(field) or "").strip():
                issues.append({"line": line, "order_id": row.get("order_id", ""),
                               "field": field, "reason": "missing"})
    return issues


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(path, rows, fieldnames):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--out", default="clean.csv")
    ap.add_argument("--report", default="report.json")
    ap.add_argument("--key", default="order_id")
    a = ap.parse_args(argv)

    rows = read_csv(a.input)
    kept, dropped = dedupe(rows, a.key)
    issues = validate(kept)
    fields = list(rows[0].keys()) if rows else list(REQUIRED)
    write_csv(a.out, [r for r, _ in kept], fields)

    report = {
        "input": a.input,
        "rows_in": len(rows),
        "rows_out": len(kept),
        "duplicates_removed": len(dropped),
        "duplicate_order_ids": sorted({(r.get(a.key) or "") for r, _ in dropped}),
        "duplicate_lines": [line for _, line in dropped],
        "validation_issues": issues,
        "rows_with_issues": len({i["order_id"] for i in issues}),
    }
    with open(a.report, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1, ensure_ascii=False)
    print(json.dumps(report, indent=1, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
