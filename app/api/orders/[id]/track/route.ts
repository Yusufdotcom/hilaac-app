import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getLoyaltyStatusForOrder } from "@/lib/loyalty/customer-status";

/**
 * GET /api/orders/[id]/track
 * Public endpoint used by the customer ordering flow to poll their own
 * order's status after checkout. Returns minimal status fields for the
 * customer status page (including takeaway delivery code via order_number).
 * Loyalty snapshot is included when enabled — never exposes customer_phone.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, customer_confirmed_at, order_type, billing_model, total, created_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const loyalty = await getLoyaltyStatusForOrder(supabase, params.id);

  return NextResponse.json({ order, loyalty });
}
