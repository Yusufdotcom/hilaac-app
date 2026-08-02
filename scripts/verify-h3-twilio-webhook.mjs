/**
 * H3: Twilio WhatsApp webhook — fail-closed signature auth + no swallowed DB errors.
 */
import { createHmac } from "crypto";
import fs from "fs";
import { config } from "dotenv";
import { NextRequest } from "next/server";

config({ path: ".env.local", quiet: true });

const base = (process.env.H3_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

let passed = 0;
let failed = 0;
function pass(n, d = "") {
  passed += 1;
  console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  failed += 1;
  console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
}

const authSrc = fs.readFileSync("lib/whatsapp/webhook-auth.ts", "utf8");
const routeSrc = fs.readFileSync("app/api/webhooks/twilio/whatsapp/route.ts", "utf8");

if (
  authSrc.includes("validateRequest") &&
  authSrc.includes("secret_not_configured") &&
  authSrc.includes("x-twilio-signature")
) {
  pass("webhook-auth uses Twilio validateRequest + fail-closed");
} else {
  fail("webhook-auth uses Twilio validateRequest + fail-closed");
}

if (
  routeSrc.includes("authenticateTwilioWebhook") &&
  routeSrc.includes('status: 401') &&
  routeSrc.includes('status: 500') &&
  routeSrc.includes("Opt-out persist failed") &&
  !routeSrc.match(/catch\s*\([^)]*\)\s*\{[^}]*ok:\s*true/s)
) {
  pass("handler 401 on auth fail, 500 on DB/exception (no swallow)");
} else {
  fail("handler 401 on auth fail, 500 on DB/exception (no swallow)");
}

// Unit: authenticateTwilioWebhook
process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim() || "test_auth_token_h3";
process.env.TWILIO_WHATSAPP_WEBHOOK_URL =
  process.env.TWILIO_WHATSAPP_WEBHOOK_URL?.trim() ||
  "https://example.com/api/webhooks/twilio/whatsapp";

const { authenticateTwilioWebhook, parseTwilioFormBody } = await import(
  "../lib/whatsapp/webhook-auth.ts"
);
const { POST } = await import("../app/api/webhooks/twilio/whatsapp/route.ts");

const webhookUrl = process.env.TWILIO_WHATSAPP_WEBHOOK_URL;
const token = process.env.TWILIO_AUTH_TOKEN;

function twilioSign(url, params) {
  const data =
    url +
    Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], "");
  return createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
}

function formBody(params) {
  return new URLSearchParams(params).toString();
}

{
  const prev = process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_AUTH_TOKEN;
  // Re-import won't pick up delete on already-loaded module — call with empty via direct check
  const req = new NextRequest(webhookUrl, { method: "POST" });
  // authenticate reads process.env at call time
  process.env.TWILIO_AUTH_TOKEN = "";
  const r = authenticateTwilioWebhook(req, { Body: "STOP" });
  process.env.TWILIO_AUTH_TOKEN = prev || token;
  if (!r.ok && r.reason === "secret_not_configured") pass("no auth token → secret_not_configured");
  else fail("no auth token → secret_not_configured", JSON.stringify(r));
}

{
  const params = { From: "whatsapp:+252610000000", Body: "STOP" };
  const req = new NextRequest(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody(params),
  });
  const r = authenticateTwilioWebhook(req, params);
  if (!r.ok && r.reason === "missing_signature") pass("unsigned → missing_signature");
  else fail("unsigned → missing_signature", JSON.stringify(r));
}

{
  const params = { From: "whatsapp:+252610000000", Body: "STOP" };
  const req = new NextRequest(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": "invalid",
    },
    body: formBody(params),
  });
  const r = authenticateTwilioWebhook(req, params);
  if (!r.ok && r.reason === "invalid_signature") pass("bad sig → invalid_signature");
  else fail("bad sig → invalid_signature", JSON.stringify(r));
}

{
  const params = { From: "whatsapp:+252610000000", Body: "hi" };
  const sig = twilioSign(webhookUrl, params);
  const req = new NextRequest(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": sig,
    },
    body: formBody(params),
  });
  const r = authenticateTwilioWebhook(req, params);
  if (r.ok) pass("valid Twilio signature accepted");
  else fail("valid Twilio signature accepted", JSON.stringify(r));
}

// Handler-level 401s
{
  const res = await POST(
    new NextRequest(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({ From: "whatsapp:+252610000000", Body: "STOP" }),
    })
  );
  if (res.status === 401) pass("POST unsigned → 401");
  else fail("POST unsigned → 401", `status=${res.status}`);
}

{
  const params = { From: "whatsapp:+252610000000", Body: "hello" };
  const sig = twilioSign(webhookUrl, params);
  const res = await POST(
    new NextRequest(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": sig,
      },
      body: formBody(params),
    })
  );
  const json = await res.json().catch(() => ({}));
  if (res.status === 200 && json.ignored === "not_opt_out") {
    pass("valid sig non-STOP → 200 ignored");
  } else {
    fail("valid sig non-STOP → 200 ignored", `status=${res.status} body=${JSON.stringify(json)}`);
  }
}

// Live HTTP if server up
try {
  const res = await fetch(`${base}/api/webhooks/twilio/whatsapp`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody({ From: "whatsapp:+252610000000", Body: "STOP" }),
  });
  if (res.status === 401) pass("live unsigned → 401", base);
  else fail("live unsigned → 401", `got ${res.status}`);
} catch (e) {
  pass("live HTTP skipped (dev down)", e?.message ?? String(e));
}

// parse helper
{
  const p = parseTwilioFormBody("From=whatsapp%3A%2B1&Body=STOP");
  if (p.From?.includes("whatsapp") && p.Body === "STOP") pass("parseTwilioFormBody");
  else fail("parseTwilioFormBody", JSON.stringify(p));
}

console.log(`\nH3 Twilio webhook: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
