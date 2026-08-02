import { createHmac, randomUUID } from "crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

const base = process.env.C3_BASE_URL ?? "http://localhost:3010";
const secret = process.env.EVC_WEBHOOK_SECRET;
if (!secret) {
  console.error("EVC_WEBHOOK_SECRET missing");
  process.exit(1);
}

const body = JSON.stringify({
  reference: randomUUID(),
  status: "success",
  transactionId: "tx-test",
});

async function check(name, res, expectStatus) {
  const text = await res.text();
  const expected = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
  const ok = expected.includes(res.status);
  console.log(ok ? "PASS" : "FAIL", name, `status=${res.status}`, `body=${text.slice(0, 160)}`);
  if (!ok) process.exitCode = 1;
}

await check(
  "webhook unsigned -> 401",
  await fetch(`${base}/api/webhooks/evc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }),
  401
);

await check(
  "webhook bad sig -> 401",
  await fetch(`${base}/api/webhooks/evc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hilaac-webhook-signature": `sha256=${"ab".repeat(32)}`,
    },
    body,
  }),
  401
);

const sig = createHmac("sha256", secret).update(body, "utf8").digest("hex");
await check(
  "webhook valid sig after auth -> 404 or 503",
  await fetch(`${base}/api/webhooks/evc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hilaac-webhook-signature": `sha256=${sig}`,
    },
    body,
  }),
  [404, 503]
);

await check(
  "charge no token -> 401",
  await fetch(`${base}/api/payments/charge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: randomUUID(), method: "evc" }),
  }),
  401
);

console.log("C3 HTTP checks done");
