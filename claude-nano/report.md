# Claude Code paying its own model calls in Nano

Initiative #12 (pursekeeper/api#89) pays for "a payer for a runtime other than OpenClaw" from a Ӿ60 line.
This is that part, reproduced on chain on 2026-10-23.

## What was missing

The shipped `scripts/inference-proxy.js` speaks OpenAI `/v1/chat/completions`. Claude Code speaks the
Anthropic Messages API at `/v1/messages`. NanoGPT's accountless x402 door serves the OpenAI shape only:
`POST https://nano-gpt.com/api/x402/v1/chat/completions` answers 402 and can be paid; `/api/x402/v1/messages`,
`/api/v1/messages` and `/api/anthropic/v1/messages` do not (`/api/v1/messages` answers 401
`missing_api_key`, so it exists only behind an account). A runtime with no account and no API key therefore
cannot reach the proxy at all, whatever its configuration. That gap is the part.

## What was built

`anthropic-shim.js` (about 190 lines, no dependencies) is an Anthropic Messages front end in front of the
unchanged proxy:

- `POST /v1/messages` is translated to `POST /v1/chat/completions` for the proxy, which pays the door as before.
- System prompt (string or block array), text blocks, `tool_use` and `tool_result` are mapped to the OpenAI
  message shapes; `tools` and `tool_choice` map to `function` tools.
- The answer maps back: `finish_reason: tool_calls` becomes a `tool_use` block with `stop_reason: tool_use`,
  which is what makes an agent loop work rather than stall on an empty message.
- `stream: true` is accepted and answered with the Anthropic event sequence
  (`message_start`, `content_block_start`/`delta`/`stop`, `message_delta`, `message_stop`). The shim asks the
  door for a plain completion and emits the events itself, because the proxy's own stream wrapping carries the
  whole message in one delta anyway; a second streaming path would add a failure mode without saving a byte.
- The proxy's refusal codes pass through unchanged (`x-payer-refused`, `error.code`), so `cap_exceeded`,
  `over_per_call_limit` and `insufficient_balance` reach the operator instead of becoming a generic 500.
- `x-payer-paid` and `x-payer-hash` are relayed on every served call, so the spend is visible per request.

Nothing in the proxy changed. The cap, the per-call limit, the allow-list, the payment-id replay guard and
the change-block retirement of a refused send all still run exactly as shipped.

## The run, on chain

Wallet `nano_3tqsjy3ihpenmc1x5dydzuff8h5joyyqnwbg8ife91uazsph8i7nuf5hrh35`, funded from the operator
wallet, cap 0.06 XNO, per-call limit 0.05 XNO, door `https://nano-gpt.com/api/x402`, model
`openai/gpt-5-nano`.

| step | result |
|---|---|
| direct `POST /v1/messages` to the shim | 200, `content: [{type: text, text: "NANO_ANTHROPIC"}]`, `x-payer-paid: 0.00003379`, `x-payer-hash: D29F7F5E8D0D2AA0B18C61100727DF760B9E0E53304C4339643471F0882688B2` |
| Claude Code 2.1.309, `ANTHROPIC_BASE_URL=http://127.0.0.1:3403`, `-p "Reply with exactly: NANO_PAID_CLAUDE_OK"` | stdout `NANO_PAID_CLAUDE_OK` |
| the call it paid | 0.04461997 XNO, block `3CE97417B50885DED03843000A60AA5AD45BA3B09CDE87C57106700EF8BF0614`, confirmed, send, from the proxy wallet to `nano_11jrdfqoggcp3es5gj5odmwe1adsmwdgjs9adok4mtjw51rbru63b3a4cfua`, height 6 |
| verification | `GET /v1/verify?hash=3CE97417…&any=1&any_to=1` answers `found: true, ok: true, confirmed: true, amount_nano: 0.04461997` |

Two refusals happened first and both are the gate working, not a fault: the first Claude Code turn was
refused `over_per_call_limit` at 0.04459166 XNO against a 0.01 limit, and the next was refused
`insufficient_balance` at 0.04461661 XNO against 0.01996 XNO in the wallet. Raising the limit and funding
the wallet made the third turn pay and return.

## Costs, measured

| call | paid |
|---|---|
| shim probe, `max_tokens: 24` | 0.00003379 XNO |
| Claude Code `-p`, one turn | 0.04461997 XNO |

A Claude Code turn costs about 1300 times a one-line probe because the runtime sends its system prompt and
tool definitions on every turn: the quote scales with input tokens, so a per-call limit below the quote of a
full turn refuses it before signing. 0.05 XNO per call was enough here; 0.01 was not. This is the same
lesson the Codex CLI recipe records, at a larger multiple.

## Two smaller findings

1. Claude Code 2.1.309 prints `Claude Code doesn't recognize the model "openai/gpt-5-nano"` and assumes a
   200k context window on every start when `ANTHROPIC_MODEL` is a door-specific id. The run is unaffected, but a
   door id outside the runtime's table makes the window a guess; naming a Claude-shaped alias in `ANTHROPIC_MODEL`
   and translating it to the door's id in the shim (`SHIM_MODEL`) avoids the warning and pins the window.
2. The shim must answer `stream: true`. Claude Code asks for a stream on some paths even for a one-line
   prompt; a shim that ignores the flag and returns JSON gets a parse failure rather than an answer.

## Files

- `anthropic-shim.js` — the shim.
- `run-proxy.sh` — the proxy with the wallet, cap and per-call limit for this run.
- `run-claude-paid.sh` — Claude Code pointed at the shim, with a private config dir.

Licence: CC0-1.0.
