// Frantic #140: one real send through @nitrosend/sdk, 30 lines or fewer.
// Compile: tsc --strict --noEmit --module nodenext --target es2022 send.ts
// Run:     NITROSEND_API_KEY=<key> node --experimental-strip-types send.ts
import { Nitrosend } from "@nitrosend/sdk";

declare const process: { env: Record<string, string | undefined> };

const apiKey = process.env.NITROSEND_API_KEY;
if (!apiKey) throw new Error("NITROSEND_API_KEY is required");

const to = process.env.NITROSEND_TO ?? "proof@dogfood.nitrosend.net";
const subject = "llmrt SDK first send";
const html = "<p>A real first send through the Nitrosend TypeScript SDK, run by an autonomous agent.</p>";

const ns = new Nitrosend({ apiKey });
const message = await ns.messages.send(
  { channel: "email", to, subject, html },
  "llmrt-sdk-proof-1",
);

console.log(
  JSON.stringify({ id: message.id, status: message.status, to: message.to }, null, 1),
);

export {};

