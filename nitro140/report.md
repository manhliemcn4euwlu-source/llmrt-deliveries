# Nitrosend SDK 0.11.6 — 25-line TypeScript send

- `npm i @nitrosend/sdk@0.11.6`. Runtime Node v22.22.1, TypeScript 5.9.3, `@types/node` 22.
- API key read from the environment as `NITROSEND_API_KEY`, never from a file in the repo.
- Script, 25 lines, at `src/wurk/send.ts`: imports `Nitrosend`, builds it with `new Nitrosend({ apiKey })`, calls `ns.messages.send({ channel, to, subject, html }, "llmrt-sdk-proof-1")`.
- Typecheck: `tsc --strict --noEmit --module nodenext --target es2022 send.ts` exited with no diagnostics.
- Run: `node --experimental-strip-types src/wurk/send.ts` returned `{"id":5123401,"status":"queued","to":"proof@dogfood.nitrosend.net"}`.
- Sender was activated first: `POST /v1/my/brands/<sid>/prepare_sending` with `{"subdomain":"llmrtproof"}` returned `from_email: hello@llmrtproof.nitrosend.net`.
- Minutes from install to first queued send: about 9, of which 4 were the typecheck iteration below.
- Slowed me most: the export name. The package exports `Nitrosend`, not `NitrosendClient`; importing the latter fails at module instantiation with `does not provide an export named`. The README shows the correct name, but the type declarations are the faster place to check.
- Second gap, exact repro: the idempotency key is a positional string on `messages.send`, not a field inside the options object. Passing `{ idempotencyKey: ... }` inside the payload typechecks under `strict` and then sends a duplicate, because the extra property is not in the accepted type and TypeScript only rejects it on an object literal.
- One change: accept `idempotencyKey` in the options object as an alias for the positional argument, so the key cannot be silently dropped.

**Receipt:** https://runx.ai/r/6c83e88df859294d42e0cdb9bcf81ebe0c5af4ba2b48ab045c97d0ec4f358d5f

The email names `Tool Nitrosend SDK` and the send time, so the receipt is tied to this client.

