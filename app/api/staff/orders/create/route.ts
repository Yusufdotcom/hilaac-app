import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { createOrderCore } from "@/lib/order/create-order-core";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { BillingModel, OrderType } from "@/types/database";

const POS_ROLES = ["owner", "manager", "cashier", "waiter"] as const;

/**
 * POST /api/staff/orders/create
 * Manual POS order — staff presence skips the Accept checkpoint.
 * Kitchen-visible immediately (status `new` + accepted_at).
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: [...POS_ROLES] });
  if (!auth.ok) return auth.response;

  const body = (await req.json()) as {
    restaurantId?: string;
    tableId?: string | null;
    orderType?: OrderType;
    items?: { menuItemId: string; quantity: number; addOnIds?: string[]; notes?: string }[];
    notes?: string;
    customerPhone?: string | null;
  };

  const restaurantId = body.restaurantId?.trim();
  const orderType = body.orderType;
  const items = body.items ?? [];

  if (!restaurantId || !orderType || items.length === 0) {
    return NextResponse.json({ error: "Missing required order fields" }, { status: 400 });
  }
  if (orderType === "dine-in" && !body.tableId) {
    return NextResponse.json({ error: "Table required for dine-in" }, { status: 400 });
  }

  const { user, profile } = auth;
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: restaurant } = await admin
    .from("restaurants")
    .select(
      "id, owner_id, is_active, dine_in_enabled, takeaway_enabled, billing_model_dinein, billing_model_takeaway"
    )
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant || !restaurant.is_active) {
    return NextResponse.json({ error: "Restaurant not found or inactive" }, { status: 404 });
  }

  const isOwner = profile.role === "owner" && restaurant.owner_id === user.id;
  const isPrimary = profile.restaurant_id === restaurantId;
  if (!isOwner && !isPrimary) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (orderType === "dine-in" && restaurant.dine_in_enabled === false) {
    return NextResponse.json({ error: "Dine-in is disabled" }, { status: 400 });
  }
  if (orderType === "takeaway" && restaurant.takeaway_enabled === false) {
    return NextResponse.json({ error: "Takeaway is disabled" }, { status: 400 });
  }

  if (orderType === "dine-in" && body.tableId) {
    const { data: table } = await admin
      .from("tables")
      .select("id, restaurant_id, is_active")
      .eq("id", body.tableId)
      .maybeSingle();
    if (!table || table.restaurant_id !== restaurantId || table.is_active === false) {
      return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }
  }

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const actorName =
    (typeof actorProfile?.full_name === "string" && actorProfile.full_name.trim()) ||
    (typeof actorProfile?.phone === "string" && actorProfile.phone.trim()) ||
    "Staff";

  const billingModel: BillingModel =
    orderType === "dine-in"
      ? (restaurant.billing_model_dinein as BillingModel) || "pay_after"
      : (restaurant.billing_model_takeaway as BillingModel) || "pay_before";

  const result = await createOrderCore({
    restaurantId,
    tableId: orderType === "dine-in" ? body.tableId ?? null : null,
    orderType,
    items: items.map((i) => ({
      menuItemId: i.menuItemId,
      quantity: i.quantity,
      addOnIds: i.addOnIds ?? [],
      notes: i.notes,
    })),
    notes: body.notes,
    customerPhone: body.customerPhone || null,
    billingModel,
    staffPos: {
      createdBy: user.id,
      acceptedBy: actorName,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  console.info("[pos] order created", {
    restaurantId,
    orderId: result.orderId,
    createdBy: user.id,
    skippedAccept: true,
  });

  return NextResponse.json({
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    total: result.total,
    skippedAccept: true,
  });
}
