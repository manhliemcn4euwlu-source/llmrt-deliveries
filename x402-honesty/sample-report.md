# x402 endpoint checkup — sample report

This is a real report, produced by the tool in this folder against a live catalogued endpoint. Nothing here is illustrative; every figure is re-runnable.

## Endpoint under test

`https://cve-intel.agentdiet.dev/v1/cve-intel`

## Verdict: MISMATCH

The catalog advertises the call as free. The endpoint asks for 10000 atomic USDC, which is $0.01.

## Field-by-field

| field | catalog | 402 quote | agree? |
|---|---|---|---|
| amount | `0` | `10000` | **no** |
| network | `eip155:8453` | `eip155:8453` | yes |
| asset | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | same | yes |
| payTo | `0xEC5275D5b03bc390FcA63D902d0B2D0Db2eb5573` | same | yes |
| method | `GET` | `GET` answers 402 | yes |

## The seller's own numbers disagree too

`GET https://agentdiet.dev/v1/try/agentdiet.dev` is their free sandbox. It returns:

```json
"production_upgrade": {
  "paid_endpoint": "https://agentdiet.dev/v1/agentdiet.dev",
  "price_usd": 0.001,
  "price_atomic_usdc": "1000"
}
```

`GET https://agentdiet.dev/v1/distill` quotes `1000`, matching the sandbox. Their `llms.txt` and `pricing.md` say `$0.002` per call. Every subdomain route quotes `1000`, `5000` or `10000`.

So one service states four prices: `0` in the catalog, `$0.001` in its own sandbox and on `/v1/distill`, `$0.002` in its docs, and up to `$0.01` on the routes a buyer actually calls.

## What a buyer experiences

An agent that reads the catalog budgets nothing and is asked to sign $0.01. An agent that reads the docs budgets $0.002 and is asked for five times that. An agent that reads the seller's sandbox budgets $0.001 and is asked for ten times that.

A client enforcing any of those ceilings refuses and stalls; the endpoint looks broken. A client that trusts the 402 overpays, on every call, silently.

## The raw evidence

```
$ curl -sS -D- -o /dev/null https://cve-intel.agentdiet.dev/v1/cve-intel
HTTP/2 402
payment-required: eyJ4NDAyVmVyc2lvbiI6Miwi...

# decoded accepts[0]:
{"scheme":"exact","network":"eip155:8453","amount":"10000",
 "asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
 "payTo":"0xEC5275D5b03bc390FcA63D902d0B2D0Db2eb5573",
 "maxTimeoutSeconds":120,
 "extra":{"name":"USD Coin","version":"2"}}
```

## Scope and limits

One unpaid GET per URL. No wallet, no payment, no retry. I did not test whether the paid call succeeds; that is a separate check. The catalog row I read was current within the hour of the probe, so this is not a stale record.

## What a fix would look like

Three numbers need to become one. The catalog row is written from whatever `accepts` a verify or settle carries, so pricing the subdomain routes consistently at the documented rate would fix the catalog on the next extension-carrying payment. If the per-tenant table is the intended source of truth, then the docs and the sandbox need to read from it instead.

## Reproducing this

```
python check_endpoint.py https://cve-intel.agentdiet.dev/v1/cve-intel \
  --docs https://agentdiet.dev/pricing.md
```

Exit code 1 means mismatch, 2 means broken, 3 means the check could not verify (never a pass).
