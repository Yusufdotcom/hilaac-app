/**
 * Verifies track token TTL behavior + auth error messages (no Next server required).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  mintChargeToken,
  mintOrderAccessToken,
  ORDER_ACCESS_TTL_SEC,
  verifyChargeToken,
} from "../lib/payments/charge-token.ts";
import { authorizeOrderAccess } from "../lib/payments/authorize-order-access.ts";

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

console.log("TTL constants (from charge-token.ts):");
console.log(`  ORDER_ACCESS_TTL_SEC = ${ORDER_ACCESS_TTL_SEC}s (${ORDER_ACCESS_TTL_SEC / 3600}h)`);
console.log("  charge DEFAULT_TTL_SEC = 900s (15m)");

const { data: restaurant } = await admin.from("restaurants").select("id").limit(1).maybeSingle();
if (!restaurant) {
  console.error("No restaurant");
  process.exit(1);
}

const { data: order, error: oErr } = await admin
  .from("orders")
  .insert({
    restaurant_id: restaurant.id,
    order_type: "takeaway",
    status: "awaiting_payment",
    payment_status: "pending",
    total: 3,
    notes: "track-ttl-verify",
  })
  .select("id")
  .single();

if (oErr || !order) {
  console.error("Seed failed:", oErr?.message);
  process.exit(1);
}

const orderId = order.id;

try {
  {
    const auth = await authorizeOrderAccess({ orderId, token: null });
    if (!auth.ok && auth.status === 401 && /phone|device|unable/i.test(auth.error)) {
      pass("no token → 401 clear message", auth.error);
    } else {
      fail("no token → 401 clear message", JSON.stringify(auth));
    }
    if (!auth.ok && auth.status === 404) fail("must not be 404 for missing token");
  }

  {
    const short = mintChargeToken(orderId, restaurant.id, 2);
    const ok = await authorizeOrderAccess({ orderId, token: short });
    if (ok.ok) pass("2s access token → authorized");
    else fail("2s access token → authorized", JSON.stringify(ok));

    await new Promise((r) => setTimeout(r, 2500));
    const expired = await authorizeOrderAccess({ orderId, token: short });
    if (!expired.ok && expired.status === 401 && /expired/i.test(expired.error)) {
      pass("after 2s → 401 expired message", expired.error);
    } else {
      fail("after 2s → 401 expired", JSON.stringify(expired));
    }
    const v = verifyChargeToken(short, { orderId });
    if (!v.ok && v.reason === "expired") pass("verifyChargeToken reason=expired");
    else fail("verifyChargeToken reason=expired", JSON.stringify(v));
  }

  {
    const access = mintOrderAccessToken(orderId, restaurant.id);
    const exp = Number(access.split(".")[2]);
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 23 * 3600 && ttl <= ORDER_ACCESS_TTL_SEC) {
      pass("mintOrderAccessToken TTL ≈ 24h", `remaining≈${Math.round(ttl / 3600)}h`);
    } else {
      fail("mintOrderAccessToken TTL ≈ 24h", `remaining=${ttl}s`);
    }
    const auth = await authorizeOrderAccess({ orderId, token: access });
    if (auth.ok) pass("24h access token → authorized");
    else fail("24h access token → authorized", JSON.stringify(auth));
  }

  {
    const charge = mintChargeToken(orderId, restaurant.id);
    const exp = Number(charge.split(".")[2]);
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 14 * 60 && ttl <= 15 * 60) pass("charge token TTL ≈ 15m", `remaining≈${ttl}s`);
    else fail("charge token TTL ≈ 15m", `remaining=${ttl}s`);
  }
} finally {
  await admin.from("orders").delete().eq("id", orderId);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
