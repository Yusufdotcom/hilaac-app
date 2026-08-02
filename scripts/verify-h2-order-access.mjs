/**
 * Live H2 checks: confirm-payment + track require order token (or reject UUID-only).
 */
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mintChargeToken, mintOrderAccessToken } from "../lib/payments/charge-token.ts";

config({ path: ".env.local", quiet: true });

function env(k) {
  let v = process.env[k] ?? "";
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
const service = env("SUPABASE_SERVICE_ROLE_KEY");
const base = env("H2_BASE_URL") || "http://localhost:3000";

if (!url || !service) {
  console.error("Missing Supabase env");
  process.exit(1);
}
if (!env("CHARGE_TOKEN_SECRET")) {
  console.error("Missing CHARGE_TOKEN_SECRET");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

const { data: restaurant, error: rErr } = await admin
  .from("restaurants")
  .select("id")
  .limit(1)
  .maybeSingle();
if (rErr || !restaurant) {
  console.error("No restaurant:", rErr?.message);
  process.exit(1);
}

const { data: order, error: oErr } = await admin
  .from("orders")
  .insert({
    restaurant_id: restaurant.id,
    order_type: "takeaway",
    status: "awaiting_payment",
    payment_status: "pending",
    total: 5,
    notes: "h2-verify",
  })
  .select("id, restaurant_id")
  .single();

if (oErr || !order) {
  console.error("Seed failed:", oErr?.message);
  process.exit(1);
}

const orderId = order.id;
const cleanup = async () => {
  await admin.from("orders").delete().eq("id", orderId);
};

try {
  // Import handlers directly (no need for running Next server)
  const { POST: confirmPost } = await import("../app/api/orders/[id]/confirm-payment/route.ts");
  const { GET: trackGet } = await import("../app/api/orders/[id]/track/route.ts");
  const { NextRequest } = await import("next/server");

  // 1) UUID only → 401
  {
    const res = await confirmPost(
      new NextRequest(`http://localhost/api/orders/${orderId}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      { params: { id: orderId } }
    );
    if (res.status === 401) pass("confirm-payment without token → 401");
    else fail("confirm-payment without token → 401", `got ${res.status}`);
  }

  {
    const res = await trackGet(
      new NextRequest(`http://localhost/api/orders/${orderId}/track`, { method: "GET" }),
      { params: { id: orderId } }
    );
    if (res.status === 401) pass("track without token → 401");
    else fail("track without token → 401", `got ${res.status}`);
  }

  // 2) Wrong order token → 401
  {
    const other = mintOrderAccessToken(randomUUID(), restaurant.id);
    const res = await trackGet(
      new NextRequest(`http://localhost/api/orders/${orderId}/track`, {
        method: "GET",
        headers: { Authorization: `Bearer ${other}` },
      }),
      { params: { id: orderId } }
    );
    if (res.status === 401 || res.status === 403) {
      pass("track with wrong-order token rejected", `status=${res.status}`);
    } else fail("track with wrong-order token rejected", `got ${res.status}`);
  }

  // 3) Valid access token → track 200
  {
    const accessToken = mintOrderAccessToken(orderId, restaurant.id);
    const res = await trackGet(
      new NextRequest(`http://localhost/api/orders/${orderId}/track`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      { params: { id: orderId } }
    );
    const json = await res.json().catch(() => ({}));
    if (res.status === 200 && json.order?.id === orderId) {
      pass("track with valid accessToken → 200");
    } else fail("track with valid accessToken → 200", `${res.status} ${JSON.stringify(json)}`);
  }

  // 4) Valid charge token → confirm 200
  {
    const chargeToken = mintChargeToken(orderId, restaurant.id);
    const res = await confirmPost(
      new NextRequest(`http://localhost/api/orders/${orderId}/confirm-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${chargeToken}`,
        },
        body: JSON.stringify({ chargeToken }),
      }),
      { params: { id: orderId } }
    );
    const json = await res.json().catch(() => ({}));
    if (res.status === 200 && json.success) {
      pass("confirm-payment with valid chargeToken → 200");
    } else {
      fail("confirm-payment with valid chargeToken → 200", `${res.status} ${JSON.stringify(json)}`);
    }
  }
} finally {
  await cleanup();
  console.log("cleanup seeded order");
}

void base;
console.log(`\nH2 order access: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
