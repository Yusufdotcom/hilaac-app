import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  isAwaitingCashierConfirmation,
  paymentStatusAwaitingCashierWrite,
} from "@/lib/payments/constants";
import {
  authorizeOrderAccess,
  extractOrderAccessToken,
} from "@/lib/payments/authorize-order-access";

/**
 * POST /api/orders/[id]/confirm-payment
 * Customer-facing: records USSD payment intent → pending_cashier_confirmation.
 * Requires order-scoped HMAC token (chargeToken/accessToken) or staff session
 * for the order's restaurant.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let bodyToken: string | null = null;
  try {
    const body = (await req.json()) as { chargeToken?: string; accessToken?: string };
    bodyToken = body.accessToken ?? body.chargeToken ?? null;
  } catch {
    // empty body OK — token may be in Authorization header
  }

  const token = extractOrderAccessToken(req, bodyToken);
  const auth = await authorizeOrderAccess({ orderId: params.id, token });
  if (!auth.ok) {
    console.warn("[orders] confirm_payment_auth_failed", {
      reason: auth.reason,
      orderId: params.id,
    });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, restaurant_id, payment_status, customer_confirmed_at")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.restaurant_id !== auth.restaurantId) {
    console.warn("[orders] confirm_payment_auth_failed", {
      reason: "restaurant_mismatch",
      orderId: params.id,
      via: auth.via,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (order.payment_status === "paid") {
    return NextResponse.json({ success: true, alreadyPaid: true });
  }

  if (order.payment_status === "failed") {
    return NextResponse.json({ error: "Payment failed for this order" }, { status: 400 });
  }

  if (isAwaitingCashierConfirmation(order)) {
    return NextResponse.json({ success: true, alreadyConfirmed: true });
  }

  if (order.customer_confirmed_at) {
    return NextResponse.json({ success: true, alreadyConfirmed: true });
  }

  // Do not patch `status` here — live DB rejects updates that re-set
  // status='awaiting_payment' (enum error). Payment fields alone are enough.
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      customer_confirmed_at: new Date().toISOString(),
      payment_status: paymentStatusAwaitingCashierWrite(),
    })
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
