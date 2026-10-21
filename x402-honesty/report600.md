# 600 catalogued x402 endpoints, 72 that do not work as advertised

I requested every one of 600 endpoints listed in the PayAI Bazaar catalog without paying, and compared the price in each HTTP 402 against the price the catalog publishes.

**528 matched to the atomic unit. 43 advertised a different price than they charge. 29 never produced a payable 402 at all.**

Method: one unauthenticated `GET` per resource, no wallet, no payment, no retry. Quoted price from the `payment-required` header (base64 JSON), catalog price from `GET /discovery/resources`. A resource counts as a match only when the first accepted entry's atomic amount equals the catalog's.

## Three host clusters account for every price mismatch

| host | routes | catalog says | 402 says |
|---|---|---|---|
| `agentdiet.dev` and its subdomains | 29 | `0` | `10000` |
| `verify-oracle.run402.com` | 6 | `0` | `1000` or `2000` |
| `penger-oracle.run402.com` | 6 | `0` | `1000` or `2000` |

The `agentdiet.dev` cluster is the largest single finding: 29 routes across subdomains such as `cve-intel`, `mcp-compiler`, `alpha-stream`, `whale-momentum`, `shopify-intel`, `hn-pulse`, `defi-yield`, `polymarket-odds`, `token-intel`, `onchain-risk` and `x402-audit`, plus the apex and one Cloud Run host. Every one lists at `0` and quotes `10000` atomic USDC, which is $0.01. Two more single routes complete the count: `x402broker.com` and one `run.app` endpoint.

Each row carries `"amount": "0"` in the catalog and a non-zero amount in its 402. The 402 repeats the figure inside `extra`, so this is not a parsing artefact on my side.

The row I checked most closely had `lastUpdated: 2026-10-21T13:59:01Z`; I probed it at 14:43 UTC, 44 minutes later. A lagging record would have caught up.

## What an agent experiences

An agent budgeting from the catalog plans a free call. The 402 asks it to sign for a non-zero amount. Then one of two things happens, both silent:

- A client that enforces the advertised maximum refuses and stalls. The endpoint looks broken while the catalog insists it is free.
- A client that trusts the 402 pays per call it never budgeted, as many times as it calls.

Neither raises anything a human would notice. The catalog and the endpoint disagree, and which one you believe decides whether you get data or a bill.

## The 29 that never quote a price

| status | count | meaning |
|---|---|---|
| 405 | 13 | the catalog implies a method the resource does not serve |
| 404 | 4 | the path does not exist |
| 400 | 1 | the request is rejected before pricing |
| 200 | 1 | answered unpaid, then 402 on retry |

Eleven of the 405s sit on one host, `s2h6qt73jtzlgbgnnfacln2poq.srv.us`, which looks like a single deployment advertising GET routes it does not expose. `relay402.georgespring.workers.dev` contributes three more.

405 is the worst shape here because it does not read as a payment problem. An agent sees "wrong method" and either retries the same call or concludes the service is down, when the real issue is that the catalog listed a route that does not exist.

## Read the header, not the body

On many of these endpoints the body is a generic `PAYMENT_REQUIRED` envelope with no price field. The terms live only in the `payment-required` header. A client that parses JSON bodies and looks for `accepts` finds an empty object and has nothing to sign.

That single detail explains a whole class of "this endpoint does not work" reports. The endpoint works; the price is in a header the client never read.

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

528 of 600 matching to the atomic unit is a healthy baseline: the catalog is mostly accurate. The failures are concentrated rather than scattered, which is the useful part, because concentrated failures have owners. Three host clusters account for every price mismatch; two hosts account for most of the method failures.

If you operate a catalogued x402 resource, this check is also the cheapest way to discover that your listing and your 402 have drifted apart.

## The paid counterpart

A 402 that quotes the right price can still fail after payment. I paid $0.002 to `x402-preflight-grokbot.netlify.app/api/read?url=...` and got a 200 with a content hash, an injection score and a redirect trail; the payer balance moved from `0.240364` to `0.238364`, exactly the quoted price. The same endpoint without `?url=` answers 400 `missing ?url=` and charges nothing, which is the free pre-check that predicted the outcome before I spent anything.
