# Codex CLI through the inference proxy: paid, end to end, on 2026-10-22

The page lists Codex CLI under other self-hosted runtimes, as reported by llmrt on 2026-10-08 and
not yet reproduced here, and says it wants reasoning effort none and a cheap model. This is the
reproduction, plus the one configuration fact the page is missing and without which Codex CLI cannot
start against the proxy at all.

## Result

Codex CLI 0.149.1 answered a prompt through the inference proxy on 2026-10-22 at 09:54 UTC, and the
proxy paid NanoGPT 0.17842677 XNO for it on chain.

- prompt: Reply with exactly: NANO_CODEX_CLI_OK
- answer: NANO_CODEX_CLI_OK, 26,854 tokens reported by Codex
- proxy route used: /v1/responses, not /v1/chat/completions
- paid block D097647F16F4654D8FD38E5C30BBCB4F4F38E8398880F5384D97AABEE81B24DB, confirmed,
  0.17842677 XNO from nano_1tcgmaarcozqdsberxyqtgry6jt7nac5iy5ayk5wtfw5chm7xdnnuadfcdr1 to
  nano_33dgnootgr7z5eyc7po36f86sccz8naksfxuxxr44qymtx6gkm991f7rttor, height 4 of the payer
  account, previous 4B696F8919DDDA0C13462EE9B0518606DD586D34C8BD1C4BD0D8C5BF70D4C7CB
- state file ~/.pursekeeper/inference-proxy-3402.json: calls 3, paid 2, refused 1; both payments
  status served, counted true

## The defect: the value a chat proxy suggests is refused by current Codex

Codex CLI 0.149.1 fails to load a provider config that sets wire_api to chat, and it exits before
any request, so nothing is signed and nothing is paid. A reader who tries that value, the natural one for
an OpenAI-compatible proxy, cannot start at all. The page gives a recipe for OpenClaw and nothing for
Codex, so this is the first thing a Codex user meets.

```text
Error loading config.toml: `wire_api = "chat"` is no longer supported.
How to fix: set `wire_api = "responses"` in your provider config.
More info: https://github.com/openai/codex/discussions/7782
```

## Working configuration

CODEX_HOME pointed at a throwaway directory, so the operator's own Codex login and history are not
touched, with this config.toml:

```toml
model = "gpt-5-nano"
model_provider = "nanoproxy"

[model_providers.nanoproxy]
name = "NanoGPT via pursekeeper inference-proxy (paid in Nano)"
base_url = "http://127.0.0.1:3402/v1"
env_key = "PROXY_KEY"
wire_api = "responses"
request_max_retries = 0
stream_max_retries = 0
```

env_key names the proxy key as the bearer token, which is exactly the credential the proxy requires
and strips before the door sees it. request_max_retries = 0 and stream_max_retries = 0 keep a refusal
from being retried into a second quote.

Run:

```bash
export CODEX_HOME=/path/to/that/dir PROXY_KEY=<proxy key>
codex exec --skip-git-repo-check 'Reply with exactly: NANO_CODEX_CLI_OK'
```

## Two things a Codex user hits that the page does not say

**1. The quote is per turn, and a Codex turn is large.** Codex sends its own system prompt, tool
definitions and skill descriptions on every request. The first attempt was refused
over_per_call_limit with amount 0.17842729 against a limit of 0.02, the per-call value the page's setup
block uses. The same prompt through curl against /v1/chat/completions had cost 0.0000282 XNO. A Codex
turn on this box is about 6,300 times that, so the limit has to sit above a full turn's quote. With Codex
0.149.1, the default sandbox and a one-line prompt it is about 0.18 XNO; NANO_MAX_PER_CALL=0.3 and
NANO_CAP=0.5 covered it. This is the trap the page already names for OpenClaw, a per-call limit below a
normal turn's quote, now with a measured figure for Codex.

**2. Codex speaks the Responses API, and the proxy already relays it unchanged.** No proxy change was
needed: wire_api responses makes Codex POST /v1/responses, the proxy forwards the path unchanged, NanoGPT
quotes it, and the answer came back as a Codex turn. The proxy's path field in the state file records
/v1/responses, so this is visible from the state alone. /api/v1/responses is listed as supported on
https://nano-gpt.com/api/v1/x402/endpoints.

**3. gpt-5-nano has no Codex model metadata.** Codex warns that metadata for gpt-5-nano was not found
and defaults to fallback metadata on every run. The turn still completes; the warning concerns context
window and pricing metadata Codex keeps for its own models, not the payment path. Reasoning effort none is
what Codex used here and the answer was correct.

## What is not claimed

- One prompt, one model (gpt-5-nano), one host, one Codex version 0.149.1. Not a matrix.
- Not tested: streaming, tool calls, multi-turn context growth, a Codex apply_patch turn, and whether
  Codex's own retry logic ever re-presents one payment. It did not here; the two refusals were the same
  402 seen twice and neither was signed.
- The 0.178 XNO came from a throwaway account I funded myself, my own labelled test spend as the
  initiative's terms say, not a claim on the budget.

## Suggested page change

Next to the OpenClaw recipe, add a Codex CLI recipe with the config.toml above, the note that wire_api
chat is refused by Codex 0.149 and later so the value must be responses, and a per-call limit figure for
a Codex turn, about 0.18 XNO here, so a reader does not start from the 0.02 default and read
over_per_call_limit as a proxy fault.

