/**
 * Invoke C3 handlers in-process (bypasses Next middleware / empty Supabase env).
 */
import { createHmac, randomUUID } from "crypto";
import { config } from "dotenv";
import { NextRequest } from "next/server";
import { handlePaymentWebhook } from "../lib/payments/process-webhook.ts";
import { POST as chargePost } from "../app/api/payments/charge/route.ts";

config({ path: ".env.local" });

const secret = process.env.EVC_WEBHOOK_SECRET;
if (!secret) {
  console.error("EVC_WEBHOOK_SECRET missing");
  process.exit(1);
}

async function check(name, res, expectStatus) {
  const text = await res.text();
  const expected = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
  const ok = expected.includes(res.status);
  console.log(ok ? "PASS" : "FAIL", name, `status=${res.status}`, `body=${text.slice(0, 160)}`);
  if (!ok) process.exitCode = 1;
}

const body = JSON.stringify({
  reference: randomUUID(),
  status: "success",
  transactionId: "tx-test",
});

await check(
  "webhook unsigned -> 401",
  await handlePaymentWebhook(
    new NextRequest("http://localhost/api/webhooks/evc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
    "evc"
  ),
  401
);

await check(
  "webhook bad sig -> 401",
  await handlePaymentWebhook(
    new NextRequest("http://localhost/api/webhooks/evc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hilaac-webhook-signature": `sha256=${"ab".repeat(32)}`,
      },
      body,
    }),
    "evc"
  ),
  401
);

const sig = createHmac("sha256", secret).update(body, "utf8").digest("hex");
// Auth passes; with empty Supabase URL in local pull this is 503, else 404 for unknown order.
await check(
  "webhook valid sig after auth -> 404 or 503",
  await handlePaymentWebhook(
    new NextRequest("http://localhost/api/webhooks/evc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hilaac-webhook-signature": `sha256=${sig}`,
      },
      body,
    }),
    "evc"
  ),
  [404, 503]
);

await check(
  "charge no token -> 401",
  await chargePost(
    new NextRequest("http://localhost/api/payments/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: randomUUID(), method: "evc" }),
    })
  ),
  401
);

console.log("C3 handler checks done");
