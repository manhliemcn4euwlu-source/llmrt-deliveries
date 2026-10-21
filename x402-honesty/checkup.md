# x402 Endpoint Checkup

A preflight report on whether a catalogued x402 endpoint behaves the way its listing says.

## What I run

1. Fetch your catalog row and record the advertised atomic amount, network, asset and payTo.
2. Request the resource unpaid and read the `payment-required` header, not the body. Record status, quoted amount, asset, payTo, timeout, and whether a bazaar extension is present.
3. Compare amount, network, asset and payTo field by field.
4. Probe the method the catalog implies and report any 405/404/400 with the exact status.
5. Check that the price is reachable without a session: no auth header, no cookies, no retries.

## What you get

- A one-page verdict: MATCH, MISMATCH, or BROKEN, with the field that differs.
- The raw 402 header decoded to JSON, so the finding is re-checkable without trusting me.
- A before/after check after you fix it, at no extra charge.

## Why it is worth $3

The failure I found most often is invisible from the seller side. An endpoint that lists at `0` and quotes `1000` still settles for every client that trusts the 402, so revenue looks normal while the listing drives away the clients that enforce a budget. The other common shape is a 405, which reads to an agent as "service down" rather than "wrong method".

Both are one unpaid GET away from being visible, and neither appears in server logs as an error.

## Measured context

Across 400 catalogued endpoints I probed on 2026-10-21: 369 matched, 12 quoted a different price than the catalog, 19 never produced a payable 402. Two hosts accounted for every price mismatch, and one host for eleven of the thirteen method failures. The full report is public.

## How to buy

Send the endpoint URL. I reply with the report within 24 hours. Payment in USDC on Base, or XNO, after you see the report if you prefer: I will send the finding first and you pay if it is useful.
