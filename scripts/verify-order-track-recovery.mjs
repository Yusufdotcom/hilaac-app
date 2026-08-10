/**
 * Verifies cross-device track recovery:
 * - UUID-only track → 401
 * - phone remint → accessToken
 * - track with reminted token → 200
 * - wrong phone → 401
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mintOrderAccessToken, ORDER_ACCESS_TTL_SEC } from "../lib/payments/charge-token.ts";

config({ path: ".env.local", quiet: true });

function env(k) {
  let v = process.env[k] ?? "";
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
const service = env("SUPABASE_SERVICE_ROLE_KEY");
const base = (env("TRACK_VERIFY_BASE_URL") || env("H2_BASE_URL") || "http://localhost:3000").replace(
  /\/$/,
  ""
);

if (!url || !service || !env("CHARGE_TOKEN_SECRET")) {
  console.error("Missing Supabase / CHARGE_TOKEN_SECRET env");
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

console.log("Current access TTL:");
console.log(`  ORDER_ACCESS_TTL_SEC = ${ORDER_ACCESS_TTL_SEC}s (${ORDER_ACCESS_TTL_SEC / 3600}h)`);
console.log(`Base URL: ${base}`);

const phone = "0612345678";
const phoneNormalizedHint = "252612345678";

const { data: restaurant } = await admin.from("restaurants").select("id, slug").limit(1).maybeSingle();
if (!restaurant) {
  console.error("No restaurant");
  process.exit(1);
}

const { data: order, error: oErr } = await admin
  .from("orders")
  .insert({
    restaurant_id: restaurant.id,
    order_type: "dine-in",
    status: "preparing",
    payment_status: "paid",
    total: 12.5,
    customer_phone: phone,
    notes: "track-recovery-verify",
  })
  .select("id, restaurant_id, customer_phone")
  .single();

if (oErr || !order) {
  console.error("Seed failed:", oErr?.message);
  process.exit(1);
}

const orderId = order.id;
console.log(`Seeded order ${orderId} phone=${order.customer_phone} (normalized≈${phoneNormalizedHint})`);

try {
  // Handler-level (no server): TTL mint still ~24h
  {
    const token = mintOrderAccessToken(orderId, restaurant.id);
    const exp = Number(token.split(".")[2]);
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 23 * 3600 && ttl <= ORDER_ACCESS_TTL_SEC) {
      pass("minted access TTL ≈ 24h", `remaining≈${Math.round(ttl / 3600)}h`);
    } else {
      fail("minted access TTL ≈ 24h", `remaining=${ttl}`);
    }
  }

  // Prefer live HTTP against Next if up; else import handlers.
  let useHttp = false;
  try {
    const ping = await fetch(`${base}/api/restaurants/${restaurant.slug}/branding`, {
      cache: "no-store",
    });
    useHttp = ping.ok;
  } catch {
    useHttp = false;
  }

  if (useHttp) {
    console.log("Using live HTTP against", base);

    const noToken = await fetch(`${base}/api/orders/${orderId}/track`, { cache: "no-store" });
    const noTokenBody = await noToken.json().catch(() => ({}));
    console.log("NET  GET /track (no token) →", noToken.status, JSON.stringify(noTokenBody));
    if (noToken.status === 401) pass("live track without token → 401");
    else fail("live track without token → 401", `got ${noToken.status}`);

    const bad = await fetch(`${base}/api/orders/${orderId}/recover-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0699999999" }),
    });
    const badBody = await bad.json().catch(() => ({}));
    console.log("NET  POST /recover-access (wrong phone) →", bad.status, JSON.stringify(badBody));
    if (bad.status === 401) pass("live recover wrong phone → 401");
    else fail("live recover wrong phone → 401", `got ${bad.status}`);

    const good = await fetch(`${base}/api/orders/${orderId}/recover-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const goodBody = await good.json().catch(() => ({}));
    console.log(
      "NET  POST /recover-access (correct phone) →",
      good.status,
      goodBody.accessToken ? "{ accessToken: <present> }" : JSON.stringify(goodBody)
    );
    if (good.status === 200 && typeof goodBody.accessToken === "string") {
      pass("live recover correct phone → 200 + accessToken");
    } else {
      fail("live recover correct phone → 200 + accessToken", `got ${good.status}`);
    }

    if (typeof goodBody.accessToken === "string") {
      const tracked = await fetch(
        `${base}/api/orders/${orderId}/track?accessToken=${encodeURIComponent(goodBody.accessToken)}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${goodBody.accessToken}` },
        }
      );
      const trackedBody = await tracked.json().catch(() => ({}));
      console.log(
        "NET  GET /track (reminted token) →",
        tracked.status,
        trackedBody.order ? `{ order.id: ${trackedBody.order.id}, status: ${trackedBody.order.status} }` : JSON.stringify(trackedBody)
      );
      if (tracked.status === 200 && trackedBody.order?.id === orderId) {
        pass("live track with reminted token → 200");
      } else {
        fail("live track with reminted token → 200", `got ${tracked.status}`);
      }
    }
  } else {
    console.log("Live server unavailable — using route handlers directly");
    const { POST: recoverPost } = await import("../app/api/orders/[id]/recover-access/route.ts");
    const { GET: trackGet } = await import("../app/api/orders/[id]/track/route.ts");
    const { NextRequest } = await import("next/server");

    const noToken = await trackGet(
      new NextRequest(`http://localhost/api/orders/${orderId}/track`),
      { params: { id: orderId } }
    );
    const noTokenBody = await noToken.json();
    console.log("NET  GET /track (no token) →", noToken.status, JSON.stringify(noTokenBody));
    if (noToken.status === 401) pass("handler track without token → 401");
    else fail("handler track without token → 401", `got ${noToken.status}`);

    const bad = await recoverPost(
      new NextRequest(`http://localhost/api/orders/${orderId}/recover-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "0699999999" }),
      }),
      { params: { id: orderId } }
    );
    console.log("NET  POST /recover-access (wrong phone) →", bad.status, await bad.json());
    if (bad.status === 401) pass("handler recover wrong phone → 401");
    else fail("handler recover wrong phone → 401", `got ${bad.status}`);

    const good = await recoverPost(
      new NextRequest(`http://localhost/api/orders/${orderId}/recover-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }),
      { params: { id: orderId } }
    );
    const goodBody = await good.json();
    console.log(
      "NET  POST /recover-access (correct phone) →",
      good.status,
      goodBody.accessToken ? "{ accessToken: <present> }" : JSON.stringify(goodBody)
    );
    if (good.status === 200 && typeof goodBody.accessToken === "string") {
      pass("handler recover correct phone → 200 + accessToken");
    } else {
      fail("handler recover correct phone → 200 + accessToken", `got ${good.status}`);
    }

    if (typeof goodBody.accessToken === "string") {
      const tracked = await trackGet(
        new NextRequest(
          `http://localhost/api/orders/${orderId}/track?accessToken=${encodeURIComponent(goodBody.accessToken)}`,
          { headers: { Authorization: `Bearer ${goodBody.accessToken}` } }
        ),
        { params: { id: orderId } }
      );
      const trackedBody = await tracked.json();
      console.log(
        "NET  GET /track (reminted token) →",
        tracked.status,
        trackedBody.order
          ? `{ order.id: ${trackedBody.order.id}, status: ${trackedBody.order.status} }`
          : JSON.stringify(trackedBody)
      );
      if (tracked.status === 200 && trackedBody.order?.id === orderId) {
        pass("handler track with reminted token → 200");
      } else {
        fail("handler track with reminted token → 200", `got ${tracked.status}`);
      }
    }
  }
} finally {
  await admin.from("orders").delete().eq("id", orderId);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
