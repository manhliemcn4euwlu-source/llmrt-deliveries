# 400 catalogued x402 endpoints, 31 that do not work as advertised

I requested every one of 400 endpoints listed in the PayAI Bazaar catalog without paying, and compared the price in each HTTP 402 against the price the catalog publishes for it.

**369 matched to the atomic unit. 12 advertised a different price than they charge. 19 never produced a payable 402 at all.**

Method: one unauthenticated `GET` per resource, no wallet, no payment, no retry. Quoted price from the `payment-required` header (base64 JSON), catalog price from `GET /discovery/resources`. A resource counts as a match only when the first accepted entry's atomic amount equals the catalog's.

## The price mismatches are host-wide, not stale rows

| host | routes | catalog says | 402 says |
|---|---|---|---|
| `verify-oracle.run402.com` | 6 | `0` | `1000` or `2000` |
| `penger-oracle.run402.com` | 6 | `0` | `1000` or `2000` |

Every route on both hosts carries `"amount": "0"` in the catalog and a non-zero amount in its 402. The `extra` object repeats the figure as `amount_usd_micros`, so this is not a parsing artefact.

The row I checked most closely had `lastUpdated: 2026-10-21T13:59:01Z`; I probed it at 14:43 UTC, 44 minutes later. A lagging record would have caught up.

## What an agent experiences

An agent budgeting from the catalog plans a free call. The 402 asks it to sign for 1000 atomic USDC. Then one of two things happens, both silent:

- A client that enforces the advertised maximum refuses and stalls. The endpoint looks broken while the catalog insists it is free.
- A client that trusts the 402 pays $0.001 per call it never budgeted, as many times as it calls.

Neither raises anything a human would notice. The catalog and the endpoint disagree, and which one you believe decides whether you get data or a bill.

## The 19 that never quote a price

| status | count | meaning |
|---|---|---|
| 405 | 13 | the catalog implies a method the resource does not serve |
| 404 | 4 | the path does not exist |
| 400 | 1 | the request is rejected before pricing |
| 200 | 1 | answered unpaid, then answered 402 on retry |

Eleven of the 405s sit on one host, `s2h6qt73jtzlgbgnnfacln2poq.srv.us`, which looks like a single deployment advertising GET routes it does not expose.

405 is the worst shape here because it does not read as a payment problem. An agent sees "wrong method" and either retries the same call or concludes the service is down, when the real issue is that the catalog listed a route that does not exist.

The single 200 is different: the same URL answered 200 without payment on the first request and 402 on a retry seconds later. That is a consistency problem rather than a catalog error, so I am not counting it as a seller defect; it is listed for completeness and excluded from the mismatch total.

## Read the header, not the body

On these endpoints the body is often a generic `PAYMENT_REQUIRED` envelope with no price field. The terms live only in the `payment-required` header. A client that parses JSON bodies and looks for `accepts` finds an empty object and has nothing to sign.

That one detail explains a whole class of "this endpoint does not work" reports. The endpoint works; the price is in a header the client never read.

## The preflight

```python
r = requests.get(url)
assert r.status_code == 402, r.status_code
terms = json.loads(base64.b64decode(r.headers['payment-required']))
quoted = int(terms['accepts'][0]['amount'])
assert quoted == int(catalog_amount), f"catalog {catalog_amount} vs 402 {quoted}"
```

Three assertions, no wallet, no cost. It catches both failure classes before an agent commits.

## What the numbers say

369 of 400 matching to the atomic unit is a healthy baseline: the catalog is mostly accurate. The failures are concentrated rather than scattered, which is the useful part, because concentrated failures have owners. Two hosts account for every price mismatch; one host accounts for most of the method failures.

If you operate a catalogued x402 resource, this check is also the cheapest way to discover that your listing and your 402 have drifted apart.
