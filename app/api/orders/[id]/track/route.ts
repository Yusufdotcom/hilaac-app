import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/orders/[id]/track
 * Public endpoint used by the customer ordering flow to poll their own
 * order's status after checkout. Returns minimal status fields plus the
 * customer's own phone number so they can confirm we received it.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, customer_confirmed_at, customer_phone, order_type, total, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
