import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getLoyaltyStatusForOrder } from "@/lib/loyalty/customer-status";
import {
  authorizeOrderAccess,
  extractOrderAccessToken,
} from "@/lib/payments/authorize-order-access";

/**
 * GET /api/orders/[id]/track
 * Customer status polling — requires order-scoped access/charge token, or
 * staff session for the order's restaurant. UUID alone is not enough.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = extractOrderAccessToken(req);
  const auth = await authorizeOrderAccess({ orderId: params.id, token });
  if (!auth.ok) {
    console.warn("[orders] track_auth_failed", {
      reason: auth.reason,
      orderId: params.id,
    });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, restaurant_id, order_number, status, payment_status, customer_confirmed_at, order_type, billing_model, total, created_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.restaurant_id !== auth.restaurantId) {
    console.warn("[orders] track_auth_failed", {
      reason: "restaurant_mismatch",
      orderId: params.id,
      via: auth.via,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { restaurant_id: _restaurantId, ...publicOrder } = order;
  const loyalty = await getLoyaltyStatusForOrder(supabase, params.id);

  return NextResponse.json({ order: publicOrder, loyalty });
}
