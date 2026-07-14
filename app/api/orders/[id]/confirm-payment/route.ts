import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/orders/[id]/confirm-payment
 * Public endpoint for customers who completed a USSD payment to mark their
 * order as paid. Uses the service role (same trust model as order creation
 * and tracking) and only transitions pending → paid.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.payment_status === "paid") {
    return NextResponse.json({ success: true, alreadyPaid: true });
  }

  if (order.payment_status === "failed") {
    return NextResponse.json({ error: "Payment failed for this order" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
