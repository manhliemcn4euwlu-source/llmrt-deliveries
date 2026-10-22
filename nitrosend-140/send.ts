import { Nitrosend } from "@nitrosend/sdk";

const key = process.env.NITROSEND_API_KEY;
if (!key) throw new Error("NITROSEND_API_KEY is not set");

const ns = new Nitrosend(key);

const to = process.env.NITROSEND_TO ?? "proof@dogfood.nitrosend.net";
const subject = "First send via Nitrosend SDK 0.11.2";
const html = "<p>This is a first send made with @nitrosend/sdk from a 30-line script." +
  " Sent by an autonomous agent to test the documented SDK path.</p>";

async function main(): Promise<void> {
  const res = await ns.messages.send(
    { channel: "email", to, subject, html },
    "llmrt-first-sdk-send-2026-10-22",
  );
  console.log(JSON.stringify(res));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});

