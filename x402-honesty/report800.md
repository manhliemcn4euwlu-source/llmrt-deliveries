# 800 catalogued x402 endpoints, 111 that do not work as advertised

I requested every one of 800 endpoints listed in the PayAI Bazaar catalog without paying, and compared the price in each HTTP 402 against the price the catalog publishes.

**689 matched to the atomic unit. 53 advertised a different price than they charge. 58 never produced a payable 402.**

Method: one unauthenticated request per resource, no wallet, no payment, no retry. Quoted price from the `payment-required` header (base64 JSON), catalog price from `GET /discovery/resources`. A resource counts as a match only when the first accepted entry's atomic amount equals the catalog's.

The sample doubled from 400 to 800 and the proportions held: 86% matched both times. The failures stay concentrated in a handful of hosts, which is the useful part, because concentrated failures have owners.

## Price mismatches: four host clusters, four different wrong numbers

| host | routes | catalog says | 402 says |
|---|---|---|---|
| `agentdiet.dev` and subdomains | 39 | `0` | `1000`, `5000` or `10000` |
| `verify-oracle.run402.com` | 6 | `0` | `1000` or `2000` |
| `penger-oracle.run402.com` | 6 | `0` | `1000` or `2000` |
| `x402broker.com` | 2 | `0` | `10000` |

The `agentdiet.dev` cluster is the largest and the most interesting, because the same service quotes four different prices depending on which door a buyer opens:

| source | price |
|---|---|
| PayAI Bazaar catalog | `0` |
| its own free sandbox, `production_upgrade.price_atomic_usdc` | `1000` |
| `/v1/distill` | `1000` |
| `llms.txt` and `pricing.md` | `$0.002` |
| all 39 subdomain routes | `1000`, `5000` or `10000` |

The sandbox block is the decisive evidence, because it is the seller telling a prospective buyer what a paid call costs:

```json
"production_upgrade": {
  "paid_endpoint": "https://agentdiet.dev/v1/agentdiet.dev",
  "price_usd": 0.001,
  "price_atomic_usdc": "1000",
  "payTo": "0xEC5275D5b03bc390FcA63D902d0B2D0Db2eb5573"
}
```

Every subdomain route then asks for up to ten times that number.

## The 58 that never quote a price: one host accounts for 24

| status | count | meaning |
|---|---|---|
| 405 | 38 | the catalog implies a method the resource does not serve |
| 404 | 11 | the path does not exist |
| 200 | 4 | answered unpaid, then 402 on retry |
| 403 | 2 | refused outright |
| 400 | 1 | rejected before pricing |
| 402 | 1 | 402 without a parseable header |
| no response | 1 | transport failure |

`payai.agentstools.dev` contributes 23 of the 405s, and the cause is one line of metadata: the catalog lists those routes as `GET`, and the server answers `405` with `allow: POST`. A POST to the same URL returns a normal 402. So the endpoint works; the catalog has the wrong method, and every GET client fails before it ever sees a price.

`s2h6qt73jtzlgbgnnfacln2poq.srv.us` adds 11 more of the same shape.

405 is the worst failure mode for a paid endpoint because it does not read as a payment problem. An agent sees "wrong method" and either retries the same call or concludes the service is down, when the real issue is that the catalog listed a route with the wrong verb.

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

Three assertions, no wallet, no cost. It catches both failure classes before an agent commits. A working implementation that also checks the seller's docs is at `src/product/x402_endpoint_checkup/check_endpoint.py`, verified against both the run402 and agentdiet mismatches.

## What the numbers say

689 of 800 matching to the atomic unit is a healthy baseline. The failures are concentrated, which makes them fixable: four hosts account for every price mismatch, and two hosts for 34 of the 38 method failures.

If you operate a catalogued x402 resource, this check is the cheapest way to discover that your listing, your docs and your 402 disagree.

## Filed upstream

- `robertoyanguas-ops/assay#1` — the four-price finding, with the sandbox response quoted.
- `kychee-com/run402#632` — the twelve zero-priced rows on the two oracle hosts.

Both are reproducible with one unpaid GET per route.
