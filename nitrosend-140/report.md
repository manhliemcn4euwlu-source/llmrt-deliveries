# First send with the Nitrosend SDK from a 25-line script

- Install: `npm install @nitrosend/sdk@latest typescript @types/node` into an empty directory.
  Resolved SDK 0.11.7, at or above the 0.11.2 floor this bounty names, so the send identifies
  itself. TypeScript 7.
- Script: 25 lines, `new Nitrosend(key)` with the key read from `process.env.NITROSEND_API_KEY`,
  one `ns.messages.send({ channel: "email", to, subject, html }, "llmrt-first-sdk-send-2026-10-22")`.
  The idempotency key is the plain string second argument, as the brief says.
- Compile: `tsc --strict`. The first run failed with three `TS2591: Cannot find name 'process'`
  errors, which is the case the brief anticipates: adding `"types": ["node"]` to tsconfig.json and
  `@types/node` to the install fixed it, and the next `tsc -p tsconfig.json` exited 0.
- Runtime: Node v22.22.1, `node --experimental-strip-types send.ts`. No tsx, no bundler, no build
  step; Node 22 runs the `.ts` file directly. It printed one warning that package.json has no
  `"type": "module"` and that the file was reparsed as ESM, which is a warning and not an error.
- Send: message id 5164621, channel email, status `queued`, created 2026-10-22T11:14:27.530Z.
- Receipt: `Your Nitrosend send receipt` arrived at 11:14:31 UTC, four seconds later, naming the
  tool as Nitrosend SDK. Link: https://runx.ai/r/967f99941fbeefddd6191085efbd922d8e74214ab2fc44d8dcf3e2078b56f56c
- Minutes from install to first send: about 5, of which 4 were the npm install and the first failed
  tsc run.

**The step that slowed me most** was the TypeScript setup, and the brief is right that it is the
part that costs time: the SDK types resolve under `moduleResolution: bundler`, and the `process` global
needs `@types/node` plus `"types": ["node"]` in the config. That is two failures before a compile
passes, and the brief predicts both. Worth keeping in the brief rather than fixing in the SDK.

**Defect or doc gap:** none in the SDK call path. The signature the brief gives
(`send(payload, idempotencyKey)` with a plain string) is the one that works, and the response carries
`id`, `status`, `createdAt` with no wrapping.

One doc gap, offered as a gap rather than a defect: the brief says the script must be published as a
`.ts` file in the gist, and the same file will not compile for a reader who copies only the `.ts`
without the tsconfig. Publishing the `tsconfig.json` beside it, as I did, is what makes the pair
reproducible; the brief could say so, because a `.ts` file that needs a config to compile is not a
self-contained artifact.

**One change I would make:** have the SDK export the response type of `messages.send` so a caller can
name it without inferring. The return is a well-shaped object and the script above prints it as JSON
because the type is not exported; a caller that wants `res.id` in a typed variable has to infer it from
the call.

Checked against https://docs.nitrosend.com for the SDK page before writing the above; the constructor,
the `messages.send` signature and the idempotency argument are the documented ones.
