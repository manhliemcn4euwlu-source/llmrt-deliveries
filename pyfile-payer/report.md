# A payer for a second supplier door: pyfile-toolkit, paid on chain

Initiative #12 at pursekeeper.dev pays, from a 60 XNO line, for "a payer for a runtime other than
OpenClaw, or for a different supplier door". This is the second of those two. The shipped
inference-proxy pays NanoGPT. pyfile-toolkit's door is a different supplier, answers the x402 v2
shape rather than NanoGPT's, and the shipped proxy does not read that shape. Below is the change
that makes one payer serve both, the on-chain payment that proves it, and the exact place where the
shipped code stops.

## What the door asks for

POST https://pyfile-agent.taile3ff35.ts.net/v1/chat/completions answers 402. The quote is an x402
v2 document in three places at once: the JSON body, a base64 `payment-required` header, and a
`www-authenticate: x402 <base64>` header. Its rail list is `accepts[]`, four entries, three of them
USDC on Base, Polygon and Arbitrum, and the fourth:

    {"scheme": "exact", "network": "nano:mainnet", "amount": "1000000000000000000000000000",
     "asset": "XNO", "payTo": "nano_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss",
     "maxTimeoutSeconds": 3600, "extra": {"work": "required", "workThreshold": "fffffff800000000"}}

0.001 XNO, work required, one hour to present the send. There is no top-level `pay_to` and no
`payment.accepted` wrapper; the address and the amount exist only inside `accepts[]`.

## Where the shipped proxy stops

`parse_quote` reads three shapes: `payment.accepted[]` with `scheme` or `network` naming nano, a
flat `pay_to` / `price_raw` object, and a base64 `payment-required` header carrying that same flat
object. A v2 `accepts[]` array matches none of them. The door therefore looks like a door with no
Nano rail, and the proxy refuses with `no_nano_option` before anything is signed:

    refused by xno payer: no_nano_option

That is fail-closed and correct given what the code knows. It is also the whole gap: a supplier who
adopts the standard v2 shape cannot be paid by this payer, and #4 spent 25 XNO per seller to get
doors to advertise `nano:mainnet`, so the rail that programme bought is the one this payer could not
read.

## The change

One reader, `_nano_from_accepts`, applied in all three places the quote can arrive: the body, the
`payment-required` header, and `www-authenticate: x402 ...`. It picks the entry whose `network` is
`nano:mainnet` (or `nano-mainnet`, or whose `scheme` is `nano`), reads `payTo` and the raw `amount`,
and returns the same quote dict the rest of the payer already handles, so the cap, the allow-list,
the send, and the `X-Nano-Payment` presentation are unchanged. Base64 padding is computed rather
than assumed: the header on this door is unpadded and a strict decoder would reject it.

Three refusals are kept, because the point of the change is to read a new shape, not to accept more:

- a v2 document with no nano entry in `accepts[]` still ends in `no_nano_option`; it is not guessed
  from a USDC entry's `payTo`;
- an `amount` that is not an integer still ends in `malformed_quote`; `"0.001"` is not scaled to raw;
- an `amount` of zero or less still ends in `malformed_quote`.

Four fixtures cover those (T15, T15b, T15c, T15d in tool/test_xno_payer_proxy.py); the existing
fourteen pass unchanged.

## The payment

Payer started on loopback, 0.05 XNO cumulative cap, 0.01 XNO per-call ceiling, the door's `payTo`
as the only allowed address. One request:

    POST /v1/chat/completions  {"model":"auto","messages":[{"role":"user",
                                 "content":"Reply with exactly: PYFILE_PAYER_OK"}]}
    200  {"model":"gemini-3.5-flash","choices":[{"message":{"content":"PYFILE_PAYER_OK"}}],
          "_routed_via":{"platform":"google","model":"gemini-3.5-flash"}}

The reply came back from gemini-3.5-flash through the door's own router, 106 total tokens, and the
payer's state file records one call, 0.001 XNO, spent 0.001 of the 0.05 cap.

The send, read back from the node rather than from the payer's own record:

    block   233125C81501D577E89C9E5EAAF61CC7D69C7EB7E941CA90D38D72863E3AB082
    from    nano_16fgnoqwia9haruycrgq38ot71bj8zthpmkutomdm7zb94egb7ucg7uk68cm
    to      nano_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss  (the door's payTo)
    amount  1000000000000000000000000000 raw = 0.001 XNO
    height  346, confirmed true

One payment, one completion, no retry and no second send. The amount is the quote to the raw digit.

## What an operator does with this

The same five-minute setup as references/inference-proxy.md, with the door and the address changed:

    NANO_CAP=0.05 NANO_MAX_PER_CALL=0.01 UPSTREAM=https://pyfile-agent.taile3ff35.ts.net \
      NANO_ALLOW_PAYTO=nano_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss \
      node inference-proxy.js

Point any OpenAI-compatible runtime at the proxy. The allow-list entry matters here in a way it does
not on NanoGPT: this door has one fixed `payTo`, so the operator can pin it, and a quote that names
any other address is refused rather than paid. That is the shape #12 asks for and the reason the
second door is worth having as a test target: an allow-list that is actually exercised, not one that
is bypassed because the supplier rotates its deposit address on every call.

## Files

    tool/xno_payer_proxy.py        parse_quote + _nano_from_accepts + _quote_from_v2 + _b64json
    tool/test_xno_payer_proxy.py   T15 / T15b / T15c / T15d

The payer and its tests carry no credentials; the wallet seed is read from a gitignored path.

