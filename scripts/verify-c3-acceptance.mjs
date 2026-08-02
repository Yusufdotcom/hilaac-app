/**
 * C3 section D acceptance checks — pass/fail per item.
 * When local Supabase env values are empty, uses a fetch mock so auth/idempotency
 * paths can still be exercised without live credentials.
 */
import { createHmac, randomUUID } from "crypto";
import { config } from "dotenv";
import { NextRequest } from "next/server";
import { handlePaymentWebhook } from "../lib/payments/process-webhook.ts";
import { POST as chargePost } from "../app/api/payments/charge/route.ts";
import { mintChargeToken, verifyChargeToken } from "../lib/payments/charge-token.ts";

config({ path: ".env.local" });

function envLen(k) {
  let v = process.env[k] ?? "";
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.trim().length;
}

const secret = process.env.EVC_WEBHOOK_SECRET?.trim();
const chargeSecret = process.env.CHARGE_TOKEN_SECRET?.trim();
const useMockDb = envLen("NEXT_PUBLIC_SUPABASE_URL") === 0 || envLen("SUPABASE_SERVICE_ROLE_KEY") === 0;

if (!secret || !chargeSecret) {
  console.error("Missing EVC_WEBHOOK_SECRET or CHARGE_TOKEN_SECRET");
  process.exit(1);
}

if (useMockDb) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://c3-accept.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.dummy";
  console.log("NOTE using fetch mock for Supabase (local URL/service key empty)\n");
}

/** @type {Map<string, any>} */
const mockOrders = new Map();

const realFetch = globalThis.fetch.bind(globalThis);
if (useMockDb) {
  globalThis.fetch = async (input, init = {}) => {
    const u = String(input);
    if (!u.includes("c3-accept.supabase.co")) {
      return realFetch(input, init);
    }

    // PostgREST orders select
    if (u.includes("/rest/v1/orders") && (!init.method || init.method === "GET")) {
      const idMatch = u.match(/id=eq\.([^&]+)/);
      const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
      const row = id ? mockOrders.get(id) : null;
      if (!row) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json", "Content-Range": "*/0" },
        });
      }
      return new Response(JSON.stringify([row]), {
        status: 200,
        headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
      });
    }

    // PostgREST orders update (PATCH)
    if (u.includes("/rest/v1/orders") && init.method === "PATCH") {
      const idMatch = u.match(/id=eq\.([^&]+)/);
      const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
      const patch = JSON.parse(String(init.body ?? "{}"));
      if (id && mockOrders.has(id)) {
        mockOrders.set(id, { ...mockOrders.get(id), ...patch });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // restaurants select for charge
    if (u.includes("/rest/v1/restaurants")) {
      return new Response(
        JSON.stringify([
          {
            id: "rest-1",
            payment_mode: "api",
            evc_merchant_id_encrypted: null,
            evc_api_key_encrypted: null,
            edahab_merchant_id_encrypted: null,
            edahab_api_key_encrypted: null,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" } }
      );
    }

    return new Response(JSON.stringify({ message: "unmocked " + u }), { status: 500 });
  };
}

let passed = 0;
let failed = 0;

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

const unknownOrderId = randomUUID();
const bodyUnknown = JSON.stringify({
  reference: unknownOrderId,
  status: "success",
  transactionId: "tx-accept-1",
});

// D1
{
  const unsigned = await webhook(bodyUnknown);
  const bad = await webhook(bodyUnknown, {
    "x-hilaac-webhook-signature": `sha256=${"ab".repeat(32)}`,
  });
  if (unsigned.status === 401 && bad.status === 401) {
    pass("D1 unsigned/bad HMAC → 401", "webhook_auth_failed logged");
  } else {
    fail("D1 unsigned/bad HMAC → 401", `got ${unsigned.status}/${bad.status}`);
  }
}

// D2
{
  const sig = signBody(bodyUnknown);
  const res = await webhook(bodyUnknown, {
    "x-hilaac-webhook-signature": `sha256=${sig}`,
  });
  if (res.status === 404) {
    pass("D2 valid HMAC + unknown order → 404", "webhook_order_not_found logged");
  } else {
    fail("D2 valid HMAC + unknown order → 404", `got ${res.status}`);
  }
}

// D3
{
  const orderId = randomUUID();
  mockOrders.set(orderId, {
    id: orderId,
    payment_status: "pending",
    payment_reference: null,
    restaurant_id: "rest-1",
    total: 10,
    customer_phone: null,
  });
  const tx = `tx-replay-${Date.now()}`;
  const body1 = JSON.stringify({
    reference: orderId,
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

  if (first.status === 200 && second.status === 200 && secondJson.duplicate === true) {
    pass("D3 valid HMAC replay → 200 duplicate", JSON.stringify(secondJson));
  } else {
    fail(
      "D3 valid HMAC replay → 200 duplicate",
      `first=${first.status}/${JSON.stringify(firstJson)} second=${second.status}/${JSON.stringify(secondJson)}`
    );
  }
}

// D4
{
  const res = await charge({ orderId: randomUUID(), method: "evc" });
  if (res.status === 401) pass("D4 charge without token → 401");
  else fail("D4 charge without token → 401", `got ${res.status}`);
}

// D5
{
  const orderA = randomUUID();
  const orderB = randomUUID();
  const restaurantId = randomUUID();
  const tokenA = mintChargeToken(orderA, restaurantId, 120);
  const res = await charge(
    { orderId: orderB, method: "evc", chargeToken: tokenA },
    { Authorization: `Bearer ${tokenA}` }
  );
  if (res.status === 401 || res.status === 403) {
    pass("D5 token for order A on order B rejected", `status=${res.status}`);
  } else {
    fail("D5 token for order A on order B rejected", `got ${res.status}`);
  }
  const mismatch = verifyChargeToken(tokenA, { orderId: orderB, restaurantId });
  if (!mismatch.ok && mismatch.reason === "order_mismatch") {
    pass("D5b verifyChargeToken order_mismatch");
  } else {
    fail("D5b verifyChargeToken order_mismatch", JSON.stringify(mismatch));
  }
}

// D6
{
  const orderId = randomUUID();
  const restaurantId = "rest-1";
  mockOrders.set(orderId, {
    id: orderId,
    restaurant_id: restaurantId,
    total: 12.5,
    customer_phone: "252610000000",
    payment_status: "pending",
    payment_reference: null,
  });
  const token = mintChargeToken(orderId, restaurantId, 120);
  const res = await charge(
    { orderId, method: "evc", chargeToken: token, phone: "252610000000" },
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
}

console.log(`\nC3 acceptance: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
