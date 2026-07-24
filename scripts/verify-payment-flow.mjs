/**
 * Verifies Pay Before (takeaway) → EVC confirm flow against the live Supabase DB.
 * Mirrors POST /api/orders then POST /api/orders/[id]/confirm-payment.
 *
 * Usage: node scripts/verify-payment-flow.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local optional if vars already exported
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PENDING_CASHIER = "pending_cashier_confirmation";

async function checkEnumValue() {
  const { data, error } = await supabase.rpc("exec_sql", {
    query: `
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'payment_status'
      ORDER BY e.enumsortorder;
    `,
  });

  if (error) {
    // Fallback: try writing the value on a throwaway check via information_schema isn't available via REST.
    // We'll infer from the confirm-payment update below.
    console.log("  (enum list via RPC unavailable — will verify by write test)");
    return null;
  }

  return data;
}

async function findTestRestaurant() {
  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, is_active")
    .eq("is_active", true)
    .limit(5);

  if (error || !restaurants?.length) {
    throw new Error(error?.message ?? "No active restaurants found");
  }

  for (const restaurant of restaurants) {
    const { data: items } = await supabase
      .from("menu_items")
      .select("id, price, is_available")
      .eq("restaurant_id", restaurant.id)
      .eq("is_available", true)
      .limit(1);

    if (items?.length) {
      return { restaurant, menuItem: items[0] };
    }
  }

  throw new Error("No restaurant with available menu items found");
}

async function run() {
  console.log("=== Payment flow verification ===\n");

  const { restaurant, menuItem } = await findTestRestaurant();
  console.log(`Restaurant: ${restaurant.name} (${restaurant.slug})`);
  console.log(`Menu item: ${menuItem.id} — $${menuItem.price}\n`);

  let orderId = null;

  try {
    // Step 1: Create Pay Before takeaway order (same as POST /api/orders)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        table_id: null,
        order_type: "takeaway",
        status: "awaiting_payment",
        payment_status: "pending",
        billing_model: "pay_before",
        payment_method: "evc",
        total: Number(menuItem.price),
        customer_phone: "+252611000000",
        notes: "[verify-payment-flow test — safe to delete]",
      })
      .select("id, payment_status")
      .single();

    if (orderError || !order) {
      throw new Error(`Order create failed: ${orderError?.message ?? "unknown"}`);
    }

    orderId = order.id;
    console.log(`✓ Created takeaway order ${orderId} (payment_status: ${order.payment_status})`);

    const { error: itemError } = await supabase.from("order_items").insert({
      order_id: orderId,
      menu_item_id: menuItem.id,
      quantity: 1,
      add_ons: [],
      price_at_time: Number(menuItem.price),
    });

    if (itemError) {
      throw new Error(`Order item insert failed: ${itemError.message}`);
    }

    // Step 2: Customer confirms payment (same as POST /api/orders/[id]/confirm-payment)
    const { error: confirmError } = await supabase
      .from("orders")
      .update({
        customer_confirmed_at: new Date().toISOString(),
        status: "awaiting_payment",
        payment_status: PENDING_CASHIER,
      })
      .eq("id", orderId);

    if (confirmError) {
      const isEnumError =
        confirmError.message.includes("enum") ||
        confirmError.message.includes("invalid input value") ||
        confirmError.code === "22P02";

      console.error("\n✗ ENUM ERROR on confirm-payment update:");
      console.error(`  ${confirmError.message}`);
      if (isEnumError) {
        console.error("\n  Fix: run migration in Supabase SQL Editor:");
        console.error(
          "  ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'pending_cashier_confirmation';"
        );
      }
      process.exit(1);
    }

    console.log(`✓ confirm-payment succeeded — no ENUM errors`);

    // Step 3: Verify payment_status in DB
    const { data: verified, error: readError } = await supabase
      .from("orders")
      .select("id, payment_status, customer_confirmed_at, billing_model, order_type, status")
      .eq("id", orderId)
      .single();

    if (readError || !verified) {
      throw new Error(`Could not read order back: ${readError?.message ?? "unknown"}`);
    }

    if (verified.payment_status !== PENDING_CASHIER) {
      console.error(`\n✗ Expected payment_status '${PENDING_CASHIER}', got '${verified.payment_status}'`);
      process.exit(1);
    }

    console.log(`✓ orders.payment_status = '${verified.payment_status}'`);

    // Step 4: Cashier verification queue filter (same logic as cashier-board.tsx)
    const { data: queueOrders, error: queueError } = await supabase
      .from("orders")
      .select("id, payment_status, customer_confirmed_at")
      .eq("restaurant_id", restaurant.id)
      .eq("payment_status", PENDING_CASHIER);

    if (queueError) {
      throw new Error(`Cashier queue query failed: ${queueError.message}`);
    }

    const inQueue = (queueOrders ?? []).some((o) => o.id === orderId);
    if (!inQueue) {
      console.error("\n✗ Order not found in cashier verification queue");
      process.exit(1);
    }

    console.log(`✓ Order appears in cashier verification queue (${queueOrders.length} pending)`);
    console.log("\n=== All checks passed ===");
  } finally {
    if (orderId) {
      await supabase.from("order_items").delete().eq("order_id", orderId);
      await supabase.from("orders").delete().eq("id", orderId);
      console.log(`\nCleaned up test order ${orderId}`);
    }
  }
}

run().catch((err) => {
  console.error("\nVerification failed:", err.message ?? err);
  process.exit(1);
});
