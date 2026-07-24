import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { mapProviderSuccessToPaymentStatus } from "@/lib/payments/constants";

/**
 * POST /api/webhooks/evc
 * Public webhook invoked by EVC Plus after a mobile money payment settles.
 * Expects a JSON body containing at least { reference, status }, where
 * `reference` is the Hilaac order id passed at charge time.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const reference = body.reference ?? body.orderId ?? body.referenceId;
  const providerStatus = String(body.status ?? "").toLowerCase();

  if (!reference) {
    return NextResponse.json({ error: "Missing order reference" }, { status: 400 });
  }

  const paymentStatus = ["success", "paid", "completed"].includes(providerStatus)
    ? mapProviderSuccessToPaymentStatus(true)
    : ["failed", "cancelled", "declined"].includes(providerStatus)
    ? "failed"
    : "pending";

  const supabase = createAdminClient();

  const { data: order, error: findError } = await supabase.from("orders").select("id").eq("id", reference).maybeSingle();
  if (findError || !order) {
    return NextResponse.json({ error: "Order not found for reference" }, { status: 404 });
  }

  const { error } = await supabase
    .from("orders")
    .update({ payment_status: paymentStatus, payment_method: "evc", payment_reference: String(body.transactionId ?? reference) })
    .eq("id", order.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
