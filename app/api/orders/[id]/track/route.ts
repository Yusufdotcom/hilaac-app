import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/orders/[id]/track
 * Public endpoint used by the customer ordering flow to poll their own
 * order's status after checkout. Deliberately returns only the minimal
 * status fields (never customer_phone or other tenants' data) — customers
 * never get direct table access to `orders` via RLS.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, payment_status, order_type, total, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
