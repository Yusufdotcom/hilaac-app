/**
 * C3 verification: charge-token + webhook HMAC auth (no live provider calls).
 * Usage: node --import tsx scripts/verify-c3-payment-auth.mjs
 * Or: npx tsx scripts/verify-c3-payment-auth.mjs
 */
import { createHmac, randomUUID } from "crypto";
import { config } from "dotenv";
import { mintChargeToken, verifyChargeToken } from "../lib/payments/charge-token.ts";
import { authenticatePaymentWebhook } from "../lib/payments/webhook-auth.ts";

config({ path: ".env.local" });

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function fakeReq(headers = {}) {
  return {
    headers: {
      get(name) {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
  };
}

let passed = 0;
function ok(name) {
  passed += 1;
  console.log("PASS", name);
}

// --- Charge token ---
const orderId = randomUUID();
const restaurantId = randomUUID();
const token = mintChargeToken(orderId, restaurantId, 60);
assert(verifyChargeToken(token, { orderId, restaurantId }).ok, "valid token");
ok("charge token mints and verifies");

assert(!verifyChargeToken(null, { orderId }).ok, "missing token rejected");
ok("charge token missing rejected");

assert(!verifyChargeToken(token, { orderId: randomUUID() }).ok, "order mismatch rejected");
ok("charge token order mismatch rejected");

const bad = token.slice(0, -2) + "aa";
assert(!verifyChargeToken(bad, { orderId, restaurantId }).ok, "tampered token rejected");
ok("charge token tamper rejected");

// --- Webhook HMAC (Hilaac) ---
const secret = process.env.EVC_WEBHOOK_SECRET;
assert(secret, "EVC_WEBHOOK_SECRET must be set in .env.local for this test");
const body = JSON.stringify({ reference: orderId, status: "success", transactionId: "tx-1" });
const sig = createHmac("sha256", secret).update(body, "utf8").digest("hex");

const good = authenticatePaymentWebhook(
  fakeReq({ "x-hilaac-webhook-signature": `sha256=${sig}` }),
  "evc",
  body
);
assert(good.ok && good.mode === "hilaac", "valid hilaac signature");
ok("webhook valid HMAC accepted");

const missing = authenticatePaymentWebhook(fakeReq({}), "evc", body);
assert(!missing.ok && missing.reason === "missing_signature", "missing sig");
ok("webhook missing signature rejected");

const wrong = authenticatePaymentWebhook(
  fakeReq({ "x-hilaac-webhook-signature": "sha256=" + "ab".repeat(32) }),
  "evc",
  body
);
assert(!wrong.ok && wrong.reason === "invalid_signature", "bad sig");
ok("webhook invalid HMAC rejected");

// WaafiPay-compatible
const ts = String(Math.floor(Date.now() / 1000));
const eventId = randomUUID();
const signing = `${ts}.${eventId}.${body}`;
const waafiSig = createHmac("sha256", secret).update(signing, "utf8").digest("hex");
const waafi = authenticatePaymentWebhook(
  fakeReq({
    "x-webhook-signature": waafiSig,
    "x-webhook-timestamp": ts,
    "x-webhook-event-id": eventId,
  }),
  "evc",
  body
);
assert(waafi.ok && waafi.mode === "waafipay", "waafipay mode");
ok("webhook WaafiPay-compatible HMAC accepted");

console.log(`\nC3 unit checks: ${passed} passed`);
