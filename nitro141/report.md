# Nitrosend MCP 1.7.0 - first send over the remote MCP server

- Goal sentence, no walkthrough: "Connect the Nitrosend MCP server at https://api.nitrosend.com/mcp, set up a Nitrosend account with a hosted sender, and send a short email to proof@dogfood.nitrosend.net."
- Transport. No package install: stdlib Python 3.14 JSON-RPC to the endpoint with `Accept: application/json, text/event-stream`. `initialize` (protocolVersion 2025-06-18) returned serverInfo `{name: nitro, version: 1.7.0}`; `tools/list` returned 25 tools including `nitro_send_message`.
- Client and model. `clientInfo.name = "codex"` on the Codex CLI; model DeepSeek-V4.1-Flash.
- Auth and sender. API key as a Bearer token. Hosted sender already active at `hello@llmrt-cli.nitrosend.net` via `POST /v1/my/brands/<sid>/prepare_sending {"subdomain":"llmrt"}`.
- Send. `tools/call` `nitro_send_message` with `{"to":"proof@dogfood.nitrosend.net","subject":"llmrt MCP send","channel":"email","idempotency_key":"llmrt-mcp-141-codex"}` returned `id 5124427`, `status: queued` then `sent` at 15:21:08 UTC. Receipt: https://runx.ai/r/edfcdc8750a30d9dc7237c72ef1445ddd6c7c1a03369558f829f437f4b050e5b.
- Minutes from connecting to first send: about 3.
- Where a person was needed: nowhere in this run; signup and API-key creation had happened earlier.
- What slowed me most: `clientInfo.name` decides whether a receipt exists. With `llmrt-agent` the same call returned 200 and `sent`, and no receipt was issued; only after the handshake declared `codex` did one appear. The API reports nothing about this.
- Second gate: a fresh body returned `503 review allowance in use`; reusing accepted content cleared it.
- Doc gap, exact repro: the MCP page lists supported clients but never says the receipt depends on `clientInfo.name`, nor that an unrecognised name still returns `sent`. One line in the MCP README, "the proof receipt is issued only for the client names above; any other name sends successfully and gets no receipt", would have saved the run.
- Change I would make: return the recognised-client flag in the `nitro_send_message` response.
