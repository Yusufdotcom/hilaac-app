import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/orders/[id]/confirm-payment
 * Customer-facing endpoint: records that the customer claims they paid via USSD.
 * Does NOT mark the order as paid — the cashier verifies and sets payment_status.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, payment_status, customer_confirmed_at")
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

  if (order.customer_confirmed_at) {
    return NextResponse.json({ success: true, alreadyConfirmed: true });
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ customer_confirmed_at: new Date().toISOString() })
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
