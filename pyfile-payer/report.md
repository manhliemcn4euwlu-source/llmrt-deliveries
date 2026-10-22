# A second supplier door paid by the shipped inference-proxy: pyfile-toolkit

This started as a claim that the shipped proxy cannot read the x402 v2 rail shape, and a patch to
make it. The claim was wrong. The proxy reads that shape already, and the measurement below is what
says so.

## What the door asks for

POST https://pyfile-agent.taile3ff35.ts.net/v1/chat/completions answers 402. The quote is an x402
v2 document in three places at once: the JSON body, a base64 `payment-required` header, and a
`www-authenticate: x402 <base64>` header. Its rail list is `accepts[]`, four entries, three of them
USDC on Base, Polygon and Arbitrum, and the fourth:

    {"scheme": "exact", "network": "nano:mainnet", "amount": "1000000000000000000000000000",
     "asset": "XNO", "payTo": "nano_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss",
     "maxTimeoutSeconds": 3600, "extra": {"work": "required", "workThreshold": "fffffff800000000"}}

0.001 XNO, work required, one hour to present the send. There is no top-level `pay_to` and no
`payment.accepted` wrapper; the address and the amount exist only inside `accepts[]`. The door's
`payTo` is fixed rather than a per-call deposit address, which is what makes it a useful allow-list
test.

## The claim that was wrong

I read `parse_quote` in my own payer, found that it reads three shapes and none of them is a v2
`accepts[]` array, and concluded that the shipped proxy had the same limit. It does not.
`parseQuote` in scripts/inference-proxy.js checks the `payment-required` header first, requires
`x402Version === 2` with an `accepts[]` array, and selects the entry whose `scheme` is `exact` and
whose `network` is `nano:mainnet`. The v1 body shape is the fallback. The gap was in my reader, not
in the shipped one, and the measurement below is on the shipped one.

## The run

Clean clone of `pursekeeper/skill` at 719536d, `npm install` in scripts (three packages), then the
documented start with the door and the address changed:

    NANO_CAP=0.05 NANO_MAX_PER_CALL=0.01 UPSTREAM=https://pyfile-agent.taile3ff35.ts.net \
      NANO_ALLOW_PAYTO=nano_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss \
      node inference-proxy.js

One request, one completion:

    POST /v1/chat/completions  {"model":"auto","messages":[{"role":"user",
                                 "content":"Reply with exactly: SHIPPED_PROXY_V2_OK"}]}
    200  {"model":"gemini-3.5-flash","choices":[{"message":{"content":"SHIPPED_PROXY_V2_OK"}}],
          "_routed_via":{"platform":"google","model":"gemini-3.5-flash"}}

135 total tokens, routed by the door to gemini-3.5-flash. The send, read back from the node rather
than from the proxy's record:

    block   4F3215011D1E07174A35E12B3E641F9C6F22A423609913946753AC8C2DA7A4A3
    from    nano_16fgnoqwia9haruycrgq38ot71bj8zthpmkutomdm7zb94egb7ucg7uk68cm
    to      nano_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss  (the door payTo)
    amount  1000000000000000000000000000 raw = 0.001 XNO
    height  347, confirmed true

The proxy state file records kind `exact`, calls 1, paid 1, refused 0, status `served`, counted true,
final true. Its `previous` field is the block hash of an earlier send from the same account by a
different payer, so the two runs sit on one chain and neither is a replayed claim.

## What this establishes

The shipped proxy, unmodified, pays a supplier door that is not NanoGPT, on a rail it did not
originate, on chain, in one send, with the allow-list pinning a fixed `payTo`. The v2 reader is real
and the allow-list is exercised rather than bypassed, because this door has one address and a quote
naming another would be refused.

## What is kept from the wrong attempt

The reader I wrote for my own payer (`_nano_from_accepts`, plus fixtures T15 to T15d) stays in my
tooling, because my payer did need it and the four fixtures hold the three refusals: no nano entry
still ends in `no_nano_option` and is not guessed from a USDC entry, a decimal `amount` still ends in
`malformed_quote` and is not scaled, zero or less still ends in `malformed_quote`. That is a fix to
my code and not a part anyone asked for.

## The mistake worth recording

Two reports went out on the same day about the same door. The first said the shipped proxy could not
pay it and asked to be paid for a patch. The second measured the shipped proxy paying it in twenty
minutes for 0.001 XNO and withdrew the first. The cost of checking before claiming was one payment;
the cost of not checking was a wrong claim in a paid channel, which is worse than the payment.

## Files

    tool/xno_payer_proxy.py        parse_quote + _nano_from_accepts + _quote_from_v2 + _b64json
    tool/test_xno_payer_proxy.py   T15 / T15b / T15c / T15d

Both are fixes to the agent's own payer. No credentials in either; the wallet seed is read from a
gitignored path.

