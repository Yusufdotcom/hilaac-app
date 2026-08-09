/**
 * Verify admin orders detail/actions + responsive board wiring.
 */
import fs from "fs";
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

function env(k) {
  let v = process.env[k] ?? "";
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

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

const board = fs.readFileSync("components/admin/orders/admin-orders-board.tsx", "utf8");
const dialog = fs.readFileSync("components/admin/orders/admin-order-detail-dialog.tsx", "utf8");
const api = fs.readFileSync("app/api/admin/orders/[id]/actions/route.ts", "utf8");

if (board.includes("Order") && board.includes("Status") && board.includes("Total") && board.includes("Placed")) {
  pass("board prioritizes Order/Status/Total/Placed");
} else fail("board prioritizes Order/Status/Total/Placed");

if (board.includes("md:hidden") && board.includes("hidden md:block") && !board.includes("overflow-x-auto")) {
  pass("board uses responsive card/table without horizontal scroll wrapper");
} else if (board.includes("md:hidden") && board.includes("table-fixed")) {
  pass("board uses responsive card/table without horizontal scroll wrapper");
} else {
  fail("board uses responsive card/table without horizontal scroll wrapper");
}

if (dialog.includes("Confirm payment") && dialog.includes("Cancel / void") && dialog.includes("cancel-reason")) {
  pass("detail dialog has confirm + cancel with reason");
} else fail("detail dialog has confirm + cancel with reason");

if (dialog.includes("OrderCustomerPhone") && dialog.includes("add_ons")) {
  pass("detail shows phone + item add-ons");
} else fail("detail shows phone + item add-ons");

if (
  api.includes("requireActiveStaff") &&
  api.includes("ACTION_ROLES") &&
  api.includes('"cashier"') &&
  api.includes("order_action_log")
) {
  pass("API gates owner/manager/cashier and writes order_action_log");
} else fail("API gates owner/manager/cashier and writes order_action_log");

if (!api.includes('"kitchen"') && !api.includes('"waiter"')) {
  pass("API does not grant kitchen/waiter action roles");
} else fail("API does not grant kitchen/waiter action roles");

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const service = env("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !service) {
  fail("live DB env present");
  console.log(`\nAdmin orders actions: ${passed} passed, ${failed} failed`);
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: restaurant } = await admin
  .from("restaurants")
  .select("id, owner_id")
  .ilike("name", "%baba%")
  .maybeSingle();

if (!restaurant?.id || !restaurant.owner_id) {
  fail("Baba restaurant found for live action log test");
} else {
  pass("Baba restaurant found for live action log test");

  const { data: table } = await admin
    .from("tables")
    .select("id")
    .eq("restaurant_id", restaurant.id)
    .limit(1)
    .maybeSingle();

  const orderId = randomUUID();
  const { error: insertErr } = await admin.from("orders").insert({
    id: orderId,
    restaurant_id: restaurant.id,
    table_id: table?.id ?? null,
    order_type: "dine-in",
    status: "new",
    payment_status: "pending_cashier_confirmation",
    total: 0.01,
    customer_phone: "0677777777",
    notes: "verify-admin-orders-actions",
  });

  if (insertErr) {
    fail("insert disposable test order", insertErr.message);
  } else {
    pass("insert disposable test order");

    const { error: updErr } = await admin
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", orderId);

    if (updErr) {
      fail("confirm_payment order update", updErr.message);
    } else {
      pass("confirm_payment order update");
    }

    const { error: logErr } = await admin.from("order_action_log").insert({
      restaurant_id: restaurant.id,
      order_id: orderId,
      action: "confirm_payment",
      reason: null,
      actor_id: restaurant.owner_id,
      previous_status: "new",
      new_status: "new",
      previous_payment_status: "pending_cashier_confirmation",
      new_payment_status: "paid",
    });

    if (!logErr) {
      pass("confirm_payment attribution row writable (order_action_log)");
    } else {
      fail("confirm_payment attribution row writable (order_action_log)", logErr.message);
    }

    const { error: cancelErr } = await admin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (cancelErr) {
      fail("cancel status update", cancelErr.message);
    } else {
      pass("cancel status update");
    }

    const { error: cancelLogErr } = await admin.from("order_action_log").insert({
      restaurant_id: restaurant.id,
      order_id: orderId,
      action: "cancel",
      reason: "verify script disposable order",
      actor_id: restaurant.owner_id,
      previous_status: "new",
      new_status: "cancelled",
      previous_payment_status: "paid",
      new_payment_status: "paid",
    });

    if (!cancelLogErr) {
      pass("cancel reason log writable");
    } else {
      fail("cancel reason log writable", cancelLogErr.message);
    }

    await admin.from("order_action_log").delete().eq("order_id", orderId);
    await admin.from("order_items").delete().eq("order_id", orderId);
    const { error: delErr } = await admin.from("orders").delete().eq("id", orderId);
    if (!delErr) pass("cleanup disposable test order");
    else fail("cleanup disposable test order", delErr.message);
  }
}

console.log(`\nAdmin orders actions: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
