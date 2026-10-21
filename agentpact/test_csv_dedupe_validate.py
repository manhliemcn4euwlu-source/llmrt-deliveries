#!/usr/bin/env python3
"""Tests for csv_dedupe_validate.py."""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import csv_dedupe_validate as m  # noqa: E402


def test_dedupe_keeps_first_and_reports_source_lines():
    rows = [
        {"order_id": "1", "customer_email": "a", "amount": "5", "date": "d"},
        {"order_id": "1", "customer_email": "a", "amount": "5", "date": "d"},
        {"order_id": "2", "customer_email": "b", "amount": "6", "date": "d"},
    ]
    kept, dropped = m.dedupe(rows)
    assert [r["order_id"] for r, _ in kept] == ["1", "2"]
    assert [line for _, line in dropped] == [3]


def test_rows_without_key_are_kept():
    rows = [{"order_id": "", "customer_email": "a"}, {"order_id": "", "customer_email": "b"}]
    kept, dropped = m.dedupe(rows)
    assert len(kept) == 2 and dropped == []


def test_validate_flags_each_missing_field():
    rows = [
        ({"order_id": "1", "customer_email": "", "amount": "", "date": "d"}, 2),
        ({"order_id": "2", "customer_email": "b", "amount": "1", "date": "d"}, 3),
    ]
    issues = m.validate(rows)
    assert len(issues) == 2
    assert {i["field"] for i in issues} == {"customer_email", "amount"}
    assert all(i["line"] == 2 for i in issues)


def test_cli_against_sample_shape():
    """End to end on a small fixture: 4 rows in, 1 duplicate, 1 missing amount."""
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "in.csv")
        with open(src, "w", newline="") as f:
            f.write("order_id,customer_email,amount,date\n"
                    "1,a@x,5.00,2026-08-01\n"
                    "1,a@x,5.00,2026-08-01\n"
                    "2,b@x,,2026-08-02\n")
        out = os.path.join(d, "clean.csv")
        rep = os.path.join(d, "report.json")
        r = subprocess.run([sys.executable, os.path.join(HERE, "csv_dedupe_validate.py"),
                            src, "--out", out, "--report", rep],
                           capture_output=True, text=True)
        assert r.returncode == 0, r.stderr
        report = json.load(open(rep))
        assert report["rows_in"] == 3
        assert report["rows_out"] == 2
        assert report["duplicates_removed"] == 1
        assert report["validation_issues"][0]["line"] == 4
        assert report["validation_issues"][0]["field"] == "amount"


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print("PASS", name)
