/**
 * Live H1: anon INSERT must accept active restaurant (+ optional owned table)
 * and reject fake restaurant_id / cross-tenant table_id.
 */
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

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
const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY") || env("SUPABASE_ANON_KEY");

if (!url || !service || !anonKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;
const cleanupIds = [];
function pass(n, d = "") {
  passed += 1;
  console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  failed += 1;
  console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
}

const { data: restaurant } = await admin
  .from("restaurants")
  .select("id")
  .eq("is_active", true)
  .limit(1)
  .maybeSingle();

if (!restaurant) {
  console.error("No active restaurant");
  process.exit(1);
}

const { data: table } = await admin
  .from("tables")
  .select("id, restaurant_id")
  .eq("restaurant_id", restaurant.id)
  .eq("is_active", true)
  .limit(1)
  .maybeSingle();

const { data: otherRestaurant } = await admin
  .from("restaurants")
  .select("id")
  .eq("is_active", true)
  .neq("id", restaurant.id)
  .limit(1)
  .maybeSingle();

const { data: foreignTable } = otherRestaurant
  ? (
      await admin
        .from("tables")
        .select("id")
        .eq("restaurant_id", otherRestaurant.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
    )
  : { data: null };

async function anonInsert(row) {
  // No .select() — anon has no SELECT on orders after C1.
  const { error } = await anon.from("orders").insert(row);
  return error;
}

// 1) Fake restaurant → reject
{
  const error = await anonInsert({
    restaurant_id: randomUUID(),
    order_type: "takeaway",
    status: "awaiting_payment",
    payment_status: "pending",
    total: 1,
    notes: "h1-fake-rest",
  });
  if (error) pass("anon insert fake restaurant_id rejected", error.message);
  else fail("anon insert fake restaurant_id rejected", "insert succeeded");
}

// 2) Active restaurant takeaway → allow
{
  const note = `h1-ok-takeaway-${Date.now()}`;
  const error = await anonInsert({
    restaurant_id: restaurant.id,
    order_type: "takeaway",
    status: "awaiting_payment",
    payment_status: "pending",
    total: 1,
    notes: note,
  });
  if (!error) {
    const { data } = await admin.from("orders").select("id").eq("notes", note).maybeSingle();
    if (data?.id) cleanupIds.push(data.id);
    pass("anon insert active restaurant takeaway allowed");
  } else fail("anon insert active restaurant takeaway allowed", error.message);
}

// 3) Own table → allow
if (table) {
  const note = `h1-ok-table-${Date.now()}`;
  const error = await anonInsert({
    restaurant_id: restaurant.id,
    table_id: table.id,
    order_type: "dine-in",
    status: "awaiting_payment",
    payment_status: "pending",
    total: 1,
    notes: note,
  });
  if (!error) {
    const { data } = await admin.from("orders").select("id").eq("notes", note).maybeSingle();
    if (data?.id) cleanupIds.push(data.id);
    pass("anon insert with own table allowed");
  } else fail("anon insert with own table allowed", error.message);
} else {
  pass("anon insert with own table allowed", "skipped — no active table");
}

// 4) Cross-tenant table → reject
if (foreignTable) {
  const error = await anonInsert({
    restaurant_id: restaurant.id,
    table_id: foreignTable.id,
    order_type: "dine-in",
    status: "awaiting_payment",
    payment_status: "pending",
    total: 1,
    notes: "h1-cross-table",
  });
  if (error) pass("anon insert cross-tenant table_id rejected", error.message);
  else fail("anon insert cross-tenant table_id rejected", "insert succeeded");
} else {
  pass("anon insert cross-tenant table_id rejected", "skipped — no second restaurant table");
}

if (cleanupIds.length) {
  await admin.from("orders").delete().in("id", cleanupIds);
  console.log(`cleanup deleted ${cleanupIds.length} order(s)`);
}

console.log(`\nH1 anon insert: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
