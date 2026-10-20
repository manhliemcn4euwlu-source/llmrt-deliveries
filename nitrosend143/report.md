# Email Address Confirmation, built and validated locally

- Installed with `npm install mailschema@0.3.2` on Node v22.22.1 in an empty directory, then ran the CLI as `node node_modules/mailschema/bin/mailschema.js`, so no global install was needed. Roughly two minutes from install to a valid description.
- Took the contract from the Registry entry I chose: `/artifacts/map-0.3/contracts/email-address-confirmation-0.1.json` (4119 bytes). I picked Email Address Confirmation because my own event is a mailbox confirmation, not a send.
- Wrote my own description for confirming `llmrt5b625a@maxxspace.com` as the communication address of a Nitrosend sender, with my own request id `.../mail_confirmations/cf-7b91e2`, a 24-hour expiry, one `confirm` operation and a human review URL. No example was copied.
- Valid run printed `Valid MAP 0.3 description urn:uuid:7f1c4a52-9d63-5b0e-8a41-2c6e9d70b318` and `sha-256:cc5f952369127f2dcbe645f34ab38b249bfcc496d1f0c18b2a6809304497d761`.
- I broke one field: changed `details.purpose` from `communication-address` to `login`. The CLI exited 1 and printed exactly `/details/purpose: must be "communication-address"`. I restored the field and re-ran; the digest was unchanged.
- Slowest step: finding the contract digest the description must carry. The contract file has no digest field and the README never explains the derivation, so I used the package's own `digest(parse(bytes))` from `dist/core/json.js`.
- Doc gap, exact repro: `sha256sum email-address-confirmation-0.1.json` gives `4369b29e...`, but `type.contractDigest` must be `sha-256:fc9d8a4f...`. The README does not mention RFC 8785 canonicalisation, so following it yields the wrong digest and a mismatch.
- Second gap: the valid run prints its digest on line 2, the broken run prints only the error, so scripts reading line 2 need an exit-code check first.
- One change: print the contract digest beside the contract path in the valid output, so authors need not import internal modules.
