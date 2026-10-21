#!/usr/bin/env python3
"""Check one catalogued x402 endpoint against its own claims.

Answers four questions with four unpaid requests, no wallet and no cost:
  1. What does the catalog say the price is?
  2. What does the 402 actually quote?
  3. Does the seller's own docs agree with either?
  4. Does the endpoint answer the method its listing implies?

Usage:
    check_endpoint.py https://example.com/api/thing
    check_endpoint.py https://example.com/api/thing --docs https://example.com/pricing.md

Exit codes: 0 match, 1 mismatch, 2 broken, 3 the check itself failed.
"""
import argparse
import base64
import json
import re
import sys
import urllib.error
import urllib.request
import urllib.parse

PROXY = None  # set from the environment, e.g. http://127.0.0.1:7890

CATALOG = "https://facilitator.payai.network/discovery/resources"
UA = {"User-Agent": "x402-endpoint-checkup/1.0"}


def _get(url, timeout=30, max_bytes=8_000_000):
    """Return (status, headers, body). Never raises for an HTTP error status."""
    req = urllib.request.Request(url, headers=UA)
    # Some hosts need an egress proxy and some refuse it; try direct, then the proxy.
    handlers = [urllib.request.ProxyHandler({})]
    if PROXY:
        handlers.append(urllib.request.ProxyHandler({"http": PROXY, "https": PROXY}))
    last = None
    for h in handlers:
        try:
            op = urllib.request.build_opener(h)
            r = op.open(req, timeout=timeout)
            return r.status, dict(r.headers), r.read(max_bytes).decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read(max_bytes).decode("utf-8", "ignore")
        except Exception as e:
            last = e
    raise SystemExit(f"transport failed for {url}: {last}")


def catalog_price(resource):
    """Look the resource up in the Bazaar and return its advertised atomic amount.

    Reads in pages because a single 1000-row response is several megabytes and gets truncated.
    """
    target = resource.rstrip("/")
    for offset in range(0, 6000, 200):
        status, _, body = _get(f"{CATALOG}?limit=200&offset={offset}")
        if status != 200:
            return None, f"catalog returned {status} at offset {offset}"
        try:
            items = json.loads(body).get("items", [])
        except Exception as e:
            return None, f"catalog unparseable at offset {offset}: {e}"
        for x in items:
            if (x.get("resource") or "").rstrip("/") == target:
                acc = (x.get("accepts") or [{}])[0]
                return acc.get("amount") or acc.get("maxAmountRequired"), None
        if len(items) < 200:
            break
    return None, "resource not found in the catalog"


def quote_from_402(headers):
    """Decode the price from the payment-required header. Returns (amount, network, payTo)."""
    raw = None
    for k, v in headers.items():
        if k.lower() == "payment-required":
            raw = v
            break
    if not raw:
        return None, None, None
    try:
        d = json.loads(base64.b64decode(raw))
    except Exception:
        return None, None, None
    acc = (d.get("accepts") or [{}])[0]
    return (acc.get("amount") or acc.get("maxAmountRequired"),
            acc.get("network"), acc.get("payTo"))


def docs_price(url):
    """Find a dollar figure in the seller's own docs. Returns (amount_usd, evidence)."""
    status, _, body = _get(url)
    if status != 200:
        return None, f"docs returned {status}"
    hits = re.findall(r"\$?(\d+\.\d{3,6})\s*/?\s*(?:per )?call", body, re.I)
    if not hits:
        hits = re.findall(r"\$(\d+\.\d{3,6})", body)
    if not hits:
        return None, "no per-call price found in docs"
    return float(hits[0]), f"first price in docs: ${hits[0]}"


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--docs", help="URL of the seller's pricing or llms.txt page")
    a = ap.parse_args(argv)

    cat_amt, cat_err = catalog_price(a.url)
    status, headers, body = _get(a.url)
    quoted, network, pay_to = quote_from_402(headers)

    print(f"resource   {a.url}")
    print(f"catalog    {cat_amt if cat_amt is not None else 'UNKNOWN (' + str(cat_err) + ')'}")
    print(f"status     {status}")
    print(f"402 quote  {quoted if quoted is not None else 'NONE'}")
    if network:
        print(f"network    {network}")
    if pay_to:
        print(f"payTo      {pay_to}")

    if a.docs:
        d_amt, d_ev = docs_price(a.docs)
        print(f"docs       {d_amt if d_amt is not None else 'UNKNOWN'} ({d_ev})")
    else:
        d_amt = None

    if status != 402 or quoted is None:
        print("VERDICT    BROKEN: no payable 402")
        return 2
    if cat_amt is None:
        # An unknown catalog price is not evidence of a match. Report it as unverified rather than
        # letting the check pass by default.
        print(f"VERDICT    UNVERIFIED: catalog lookup failed ({cat_err})")
        return 3
    if str(quoted) != str(cat_amt):
        print(f"VERDICT    MISMATCH: catalog {cat_amt} vs 402 {quoted}")
        return 1
    if d_amt is not None and int(quoted) != int(round(d_amt * 1e6)):
        print(f"VERDICT    MISMATCH: docs ${d_amt} vs 402 {quoted} atomic")
        return 1
    print("VERDICT    MATCH")
    return 0


if __name__ == "__main__":
    sys.exit(main())
