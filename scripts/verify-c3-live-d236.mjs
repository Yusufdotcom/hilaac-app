/**
 * Live-only C3 checks D2, D3, D6 against remote Supabase (no fetch mock).
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + webhook/charge secrets.
 *
 * Usage: node --experimental-strip-types scripts/verify-c3-live-d236.mjs
 */
import { createHmac, randomUUID } from "crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { handlePaymentWebhook } from "../lib/payments/process-webhook.ts";
import { POST as chargePost } from "../app/api/payments/charge/route.ts";
import { mintChargeToken } from "../lib/payments/charge-token.ts";

config({ path: ".env.local" });

function envVal(k) {
  let v = process.env[k] ?? "";
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const url = envVal("NEXT_PUBLIC_SUPABASE_URL") || envVal("SUPABASE_URL");
const service =
  envVal("SUPABASE_SERVICE_ROLE_KEY") || envVal("SUPABASE_SECRET_KEY");
const secret = envVal("EVC_WEBHOOK_SECRET");
const chargeSecret = envVal("CHARGE_TOKEN_SECRET");

if (!url || !service) {
  console.error("FAIL  live Supabase env missing (url/service). Refusing mock.");
  process.exit(1);
}
if (!secret || !chargeSecret) {
  console.error("FAIL  Missing EVC_WEBHOOK_SECRET or CHARGE_TOKEN_SECRET");
  process.exit(1);
}

process.env.NEXT_PUBLIC_SUPABASE_URL = url;
process.env.SUPABASE_SERVICE_ROLE_KEY = service;

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;
const cleanupIds = [];

function pass(name, detail = "") {
  passed += 1;
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  failed += 1;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function signBody(body) {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

async function webhook(body, headers = {}) {
  return handlePaymentWebhook(
    new NextRequest("http://localhost/api/webhooks/evc", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    }),
    "evc"
  );
}

async function charge(payload, headers = {}) {
  return chargePost(
    new NextRequest("http://localhost/api/payments/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    })
  );
}

async function seedPendingOrder() {
  const { data: restaurant, error: rErr } = await admin
    .from("restaurants")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (rErr || !restaurant?.id) {
    throw new Error(`No restaurant to seed against: ${rErr?.message ?? "none"}`);
  }

  const { data: order, error: oErr } = await admin
    .from("orders")
    .insert({
      restaurant_id: restaurant.id,
      order_type: "takeaway",
      status: "awaiting_payment",
      payment_status: "pending",
      total: 10.0,
      customer_phone: "252610000000",
      notes: "c3-live-d236",
    })
    .select("id, restaurant_id")
    .single();

  if (oErr || !order) {
    throw new Error(`Failed to seed order: ${oErr?.message ?? "unknown"}`);
  }
  cleanupIds.push(order.id);
  return order;
}

console.log("MODE  live remote Supabase (no fetch mock)");
console.log("url_host", new URL(url).host);

// D2
{
  const unknownOrderId = randomUUID();
  const bodyUnknown = JSON.stringify({
    reference: unknownOrderId,
    status: "success",
    transactionId: "tx-accept-live-1",
  });
  const sig = signBody(bodyUnknown);
  const res = await webhook(bodyUnknown, {
    "x-hilaac-webhook-signature": `sha256=${sig}`,
  });
  if (res.status === 404) {
    pass("D2 valid HMAC + unknown order → 404", "live lookup");
  } else {
    const j = await res.json().catch(() => ({}));
    fail("D2 valid HMAC + unknown order → 404", `got ${res.status} ${JSON.stringify(j)}`);
  }
}

// D3
{
  try {
    const order = await seedPendingOrder();
    const tx = `tx-replay-live-${Date.now()}`;
    const body1 = JSON.stringify({
      reference: order.id,
      status: "success",
      transactionId: tx,
    });
    const sig1 = signBody(body1);
    const first = await webhook(body1, {
      "x-hilaac-webhook-signature": `sha256=${sig1}`,
    });
    const firstJson = await first.json().catch(() => ({}));
    const second = await webhook(body1, {
      "x-hilaac-webhook-signature": `sha256=${sig1}`,
    });
    const secondJson = await second.json().catch(() => ({}));

    if (
      first.status === 200 &&
      second.status === 200 &&
      secondJson.duplicate === true
    ) {
      pass("D3 valid HMAC replay → 200 duplicate", JSON.stringify(secondJson));
    } else {
      fail(
        "D3 valid HMAC replay → 200 duplicate",
        `first=${first.status}/${JSON.stringify(firstJson)} second=${second.status}/${JSON.stringify(secondJson)}`
      );
    }
  } catch (e) {
    fail("D3 valid HMAC replay → 200 duplicate", String(e?.message ?? e));
  }
}

// D6
{
  try {
    const order = await seedPendingOrder();
    const token = mintChargeToken(order.id, order.restaurant_id, 120);
    const res = await charge(
      {
        orderId: order.id,
        method: "evc",
        chargeToken: token,
        phone: "252610000000",
      },
      { Authorization: `Bearer ${token}` }
    );
    if (res.status === 401 || res.status === 403) {
      fail("D6 valid token proceeds past auth", `got ${res.status}`);
    } else {
      pass(
        "D6 valid token proceeds past auth",
        `status=${res.status} (auth cleared; provider/creds may still fail)`
      );
    }
  } catch (e) {
    fail("D6 valid token proceeds past auth", String(e?.message ?? e));
  }
}

if (cleanupIds.length) {
  await admin.from("orders").delete().in("id", cleanupIds);
  console.log(`cleanup deleted ${cleanupIds.length} seeded order(s)`);
}

console.log(`\nLive D2/D3/D6: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
