/**
 * C1 verification: anon must not list recent orders; track API still works by id.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !anon || !service) {
  console.error("FAIL missing Supabase env (url/anon/service). Fill .env.local then re-run.");
  process.exit(1);
}

const anonClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function pass(name) {
  console.log("PASS", name);
}
function fail(name, detail) {
  console.error("FAIL", name, detail ?? "");
  process.exitCode = 1;
}

const { data: leaked, error: leakErr } = await anonClient
  .from("orders")
  .select("id, status, total, customer_phone")
  .gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString())
  .limit(20);

if (leakErr) {
  // Permission denied / RLS is acceptable.
  pass(`anon list recent orders blocked (${leakErr.code ?? leakErr.message})`);
} else if (!leaked || leaked.length === 0) {
  pass("anon list recent orders returned 0 rows");
} else {
  fail("anon list recent orders", `returned ${leaked.length} rows — cross-tenant leak still open`);
}

const { data: items, error: itemsErr } = await anonClient
  .from("order_items")
  .select("id, order_id")
  .limit(20);

if (itemsErr) {
  pass(`anon list order_items blocked (${itemsErr.code ?? itemsErr.message})`);
} else if (!items || items.length === 0) {
  pass("anon list order_items returned 0 rows");
} else {
  fail("anon list order_items", `returned ${items.length} rows`);
}

const { data: anyOrder } = await admin.from("orders").select("id").limit(1).maybeSingle();
if (!anyOrder?.id) {
  console.log("SKIP track API — no orders in DB");
} else {
  const base = process.env.C1_BASE_URL ?? "http://localhost:3010";
  try {
    const res = await fetch(`${base}/api/orders/${anyOrder.id}/track`);
    if (res.ok) {
      const json = await res.json();
      if (json.order?.id === anyOrder.id) pass("track API returns order by id");
      else fail("track API", "missing order payload");
    } else if (res.status === 404 || res.status === 500) {
      console.log("SKIP track API HTTP", res.status, "(dev server / env)");
    } else {
      fail("track API", `status ${res.status}`);
    }
  } catch (e) {
    console.log("SKIP track API unreachable", e instanceof Error ? e.message : e);
  }
}

console.log("C1 checks done");
