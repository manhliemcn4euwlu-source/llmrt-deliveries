# 1,000 catalogued x402 endpoints: 881 match, 53 disagree, 66 cannot be paid

I requested every one of 1,000 endpoints listed in the PayAI Bazaar catalog without paying, and compared the price in each HTTP 402 against the price the catalog publishes.

**881 matched to the atomic unit (88.1%). 53 quoted a different amount. 66 never produced a payable 402.**

Method: one unauthenticated request per resource, no wallet, no payment, no retry. Quoted price from the `payment-required` header (base64 JSON), catalog price from `GET /discovery/resources`. A resource counts as a match only when the first accepted entry's atomic amount equals the catalog's.

The sample grew from 200 to 1,000 endpoints in five batches. The match rate held at 86-88% throughout, so the earlier numbers were not noise.

## Price mismatches: four hosts, not a systemic problem

| host | routes | catalog | 402 |
|---|---|---|---|
| `agentdiet.dev` and subdomains | 39 | `0` | `1000`, `5000`, `10000` |
| `verify-oracle.run402.com` | 6 | `0` | `1000`, `2000` |
| `penger-oracle.run402.com` | 6 | `0` | `1000`, `2000` |
| `x402broker.com` | 2 | `0` | `10000` |

Every one of the 53 sits on four hosts. The fifth batch, 200 endpoints I had not touched before, produced **zero** price mismatches. That is the most useful result in this whole exercise: the catalog is not broadly wrong, it has a handful of specific bad rows.

## Which side is wrong

A catalog-versus-endpoint gap has two possible owners and they need opposite fixes. I checked the seller's own documentation as a third source on the largest cluster:

| route | documented | quoted | who is wrong |
|---|---|---|---|
| prompt-guard.agentdiet.dev | $0.005 | 5000 | catalog |
| json-repair.agentdiet.dev | $0.002 | 2000 | catalog |
| x402broker.com | $0.010 | 10000 | catalog |
| assay.agentdiet.dev | $0.005 | 10000 | seller |
| preflight.agentdiet.dev | $0.005 | 10000 | seller |
| agentdiet.dev/v1/distill | $0.001 | no 402 | seller |

Three of six charge exactly what their own docs say, so the catalog is the defect. Two overcharge against their own docs. One no longer answers with a 402 at all.

That reverses the naive reading. Thirty-six of the thirty-nine agentdiet routes are being misrepresented by the catalog, not overcharging. A report that said otherwise would have sent the seller looking in the wrong place.

## The 66 that cannot be paid

| status | count | meaning |
|---|---|---|
| 405 | 40 | the catalog implies a method the resource does not serve |
| 404 | 13 | the path does not exist |
| 200 | 6 | answered unpaid, then 402 on retry |
| 403 | 4 | refused outright |
| 400 | 2 | rejected before pricing |
| no response | 1 | transport failure |

`payai.agentstools.dev` contributes 23 of the 405s and the cause is one line of metadata: the catalog lists those routes as `GET`, and the server answers `405` with `allow: POST`. A POST to the same URL returns a normal 402. The endpoints work; the catalog has the wrong verb.

`s2h6qt73jtzlgbgnnfacln2poq.srv.us` adds 11 more of the same shape, and `relay402.georgespring.workers.dev` three.

405 is the worst failure mode for a paid endpoint because it does not read as a payment problem. An agent sees "wrong method" and either retries the same call or concludes the service is down.

## Read the header, not the body

On many of these endpoints the body is a generic `PAYMENT_REQUIRED` envelope with no price field. The terms live only in the `payment-required` header. A client that parses JSON bodies and looks for `accepts` finds an empty object and has nothing to sign.

That one detail explains a whole class of "this endpoint does not work" reports. The endpoint works; the price is in a header the client never read.

## The preflight, with three sources

```python
r = requests.get(url)
assert r.status_code == 402, r.status_code
terms = json.loads(base64.b64decode(r.headers['payment-required']))
quoted = int(terms['accepts'][0]['amount'])
if quoted != int(catalog_amount):
    culprit = 'seller' if quoted != docs_amount else 'catalog'
```

Three assertions and one extra comparison, no wallet, no cost. The last line is what turns a verdict into something the owner can act on.

## What the numbers say

881 of 1,000 matching to the atomic unit is a healthy catalog. The failures are concentrated, which makes them fixable: four hosts account for every price mismatch, and two hosts for 34 of the 40 method failures.

If you operate a catalogued x402 resource, this check is the cheapest way to discover that your listing, your docs and your 402 disagree, and it tells you which of the three is the odd one out.

## Filed upstream

- `robertoyanguas-ops/assay#1` — the agentdiet finding, with the correction that most routes match their docs and the catalog is the culprit.
- `kychee-com/run402#632` — the twelve zero-priced rows on the two oracle hosts.

Both are reproducible with one unpaid GET per route.
