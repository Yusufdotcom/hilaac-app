/**
 * Diagnose duplicate order IDs from production bug report; delete test rows after.
 * Usage: npx tsx scripts/audit-dup-orders.mjs [--delete]
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const DELETE = process.argv.includes("--delete");
const IDS = [
  "306596d4-bb77-41c1-879a-42e4d6a49171",
  "f622af7b-54ed-4ce5-b838-b4e9b66fdc36",
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: byId, error: idErr } = await admin
  .from("orders")
  .select(
    "id, order_number, restaurant_id, table_id, customer_phone, status, payment_status, total, created_at, tables(table_number), restaurants(name, slug)"
  )
  .in("id", IDS);

console.log("By reported IDs:", idErr?.message ?? `${byId?.length ?? 0} row(s)`);
for (const o of byId ?? []) {
  console.log(JSON.stringify(o, null, 2));
}

const { data: rest } = await admin
  .from("restaurants")
  .select("id")
  .eq("slug", "baba-s-grill-and-cafe")
  .maybeSingle();

if (rest?.id) {
  const { data: byPhone } = await admin
    .from("orders")
    .select(
      "id, order_number, customer_phone, status, total, created_at, table_id, tables(table_number)"
    )
    .eq("restaurant_id", rest.id)
    .eq("customer_phone", "0699999999")
    .order("created_at", { ascending: false })
    .limit(20);
  console.log("\nBy phone 0699999999:", byPhone?.length ?? 0);
  for (const o of byPhone ?? []) console.log(JSON.stringify(o));

  // Also try normalized variants
  for (const phone of ["+252699999999", "699999999", "252699999999"]) {
    const { data } = await admin
      .from("orders")
      .select("id, customer_phone, created_at, tables(table_number)")
      .eq("restaurant_id", rest.id)
      .eq("customer_phone", phone)
      .limit(10);
    if (data?.length) {
      console.log(`phone ${phone}:`, data.length, data.map((d) => d.id));
    }
  }
}

if (DELETE) {
  const idsToDelete = new Set([
    ...(byId ?? []).map((o) => o.id),
  ]);
  // Prefer phone+table2 match for Baba's
  if (rest?.id) {
    const { data: tables } = await admin
      .from("tables")
      .select("id")
      .eq("restaurant_id", rest.id)
      .eq("table_number", "2");
    const tableIds = (tables ?? []).map((t) => t.id);
    const { data: match } = await admin
      .from("orders")
      .select("id")
      .eq("restaurant_id", rest.id)
      .eq("customer_phone", "0699999999")
      .in("table_id", tableIds.length ? tableIds : ["00000000-0000-0000-0000-000000000000"]);
    for (const o of match ?? []) idsToDelete.add(o.id);

    // Also delete reported IDs even if phone differs
    for (const id of IDS) idsToDelete.add(id);
  }

  const list = [...idsToDelete];
  console.log("\nDeleting:", list);
  if (list.length) {
    await admin.from("order_items").delete().in("order_id", list);
    const { error } = await admin.from("orders").delete().in("id", list);
    console.log(error ? `DELETE FAIL ${error.message}` : `DELETED ${list.length}`);
  }
}
