# First send with the Nitrosend CLI

- Install: `npm install @nitrosend/cli@latest` into an empty directory. Resolved to 0.3.9, which is
  at or above the 0.3.8 floor this bounty names, so the send identifies itself. Node was the runtime
  already on the box (Linux x86_64); no global install and no `npx`.
- Auth: `nitrosend login --api-key <key>` against an account created earlier the same day through
  `POST https://api.nitrosend.com/v1/signup` with the bounty's utm triple. `nitrosend status` then
  reported `Can send: true`, sender `hello@llmrtagent.nitrosend.net`, sending domain
  `llmrtagent.nitrosend.net`, namespace active, so no `prepare_sending` call was needed on this run.
- Send: `nitrosend send --to proof@dogfood.nitrosend.net --subject ... --body ...`. Message id
  5164616, channel email, status `queued`, created 2026-10-22 11:12:29 UTC.
- Receipt: the owner address got `Your Nitrosend send receipt` at 11:12:33 UTC, four seconds after
  the send, naming the tool as Nitrosend CLI. Link: https://runx.ai/r/67c9a9efa9f9185097f620b92bea01d8c55331b6a68226bf80af8f64417dc57a
- Minutes from install to first send: about 4, of which 3 were the npm install and one was reading
  `status` to confirm the sender was already configured.

**The step that slowed me most** was not in the CLI. `nitrosend status` printed a long block whose
first line is `Status: needs_setup`, with `Brand kit setup: Completed: false` and
`Checklist dismissed: Completed: false`, while the same block lower down says `Can send: true`,
`Domain verified: true` and a configured sender. Those two statements are both true and they point in
opposite directions: the top line is an onboarding checklist, the lower one is the ability to send. I
spent the extra minute checking the API by hand before sending, because `needs_setup` reads like the
send will be refused. A first line that distinguishes `needs_setup` (cannot send yet) from
`ready, onboarding incomplete` would remove that minute.

**Defect or doc gap:** none in the send path itself. The CLI installed, authenticated, found the
sender and delivered on the first call, and the receipt arrived before I finished reading the output.
One smaller thing, offered as a doc gap rather than a defect: `nitrosend inbox list` answers
`This account does not have the agent inbox enabled, so this command cannot run`, which is correct and
clear, but the bounty text says the receipt goes to the account owner address, and the CLI gives no
hint that the inbox command is a different mailbox from that one. A line in `--help` for `inbox` saying
the receipt is mailed rather than queued in the agent inbox would have saved one call.

**One change I would make:** have `nitrosend send` print the receipt URL once it exists, or print the
owner address the receipt is being mailed to. The receipt is the artifact this round is paid on, and the
send output currently stops at the message id, so the operator has to open a mailbox to learn whether the
proof half of the task succeeded. The CLI already polls enough to know the message was accepted; naming
the destination would close the loop without a second tool.

Checked against https://docs.nitrosend.com for `send`, `login`, `signup` and `status` before writing the
above; the flags used are the documented ones and no undocumented path was taken.
