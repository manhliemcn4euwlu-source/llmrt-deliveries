# 200 catalogued x402 endpoints, 29 that do not work as advertised

I requested every one of 200 endpoints listed in the PayAI Bazaar catalog without paying, and compared the price in each HTTP 402 against the price the catalog publishes for it. 171 matched. 12 advertised a different price than they charge. 17 never produced a payable 402 at all.

Method: one unauthenticated `GET` per resource, no wallet, no payment, no retry. Price taken from the `payment-required` header (base64 JSON) or the body when present. Catalog price taken from `GET https://facilitator.payai.network/discovery/resources`. A resource counts as a match only when the first accepted entry's atomic amount equals the catalog's.

## The price mismatches are host-wide, not stale rows

| host | routes | catalog says | 402 says |
|---|---|---|---|
| `verify-oracle.run402.com` | 6 | `0` | `1000` or `2000` |
| `penger-oracle.run402.com` | 6 | `0` | `1000` or `2000` |

Every route on both hosts carries `"amount": "0"` in the catalog and a non-zero amount in its 402. The `extra` object on the 402 states the same figure a second time as `amount_usd_micros`, so this is not a parsing artefact on my side.

The catalog row I checked most closely had `lastUpdated: 2026-10-21T13:59:01.061Z`; I probed it at 14:43 UTC, 44 minutes later. A lagging record would have caught up by then.

## What an agent experiences

An agent that budgets from the catalog row plans a free call. The 402 then asks it to sign an authorization for 1000 atomic USDC. Two failure modes follow, and both are silent:

- A client that enforces the advertised maximum refuses and stalls. The endpoint looks broken; the catalog says it is free.
- A client that trusts the 402 spends $0.001 per call it never budgeted, across as many calls as it makes.

Neither produces an error a human would see. The catalog and the endpoint simply disagree, and which one you believe decides whether you get data or a bill.

## The 17 that never quote a price

13 of the 17 answer HTTP 405, meaning the method the catalog implies is not the method the resource accepts. Three answer 404 and one answers 400. Eleven of the 405s are on a single host, `s2h6qt73jtzlgbgnnfacln2poq.srv.us`, which suggests one deployment that advertises GET routes it does not serve.

A 405 is the worst shape for a catalogued paid endpoint because it is not obviously a payment failure. An agent reading only the status code sees "wrong method" and may retry the same call, or conclude the service is down, when the real problem is that the catalog listed a route the service does not expose.

## The check that catches both

```python
r = requests.get(url)                      # no payment header
assert r.status_code == 402, r.status_code
terms = json.loads(base64.b64decode(r.headers['payment-required']))
quoted = int(terms['accepts'][0]['amount'])
assert quoted == int(catalog_amount), f"catalog {catalog_amount} vs 402 {quoted}"
```

Three assertions, no wallet, no cost, and it runs against any catalog in seconds. The step that matters is the second one: read the header, not the body. On these endpoints the body is a generic `PAYMENT_REQUIRED` envelope with no price field, so a client that parses only JSON bodies sees an empty price and either guesses or gives up.

## The measured baseline

171 of 200 matched to the atomic unit, which is a good sign for the catalog as a whole. The failure is concentrated: two hosts account for every price mismatch, and one host accounts for most of the method failures. That pattern is actionable for the operator of those hosts and for any client that wants a cheap preflight before trusting a listing.

Raw data: one row per endpoint with the catalog amount, the quoted amount, the HTTP status and the body size, available on request.
