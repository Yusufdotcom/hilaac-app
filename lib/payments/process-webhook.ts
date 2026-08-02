import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { mapProviderSuccessToPaymentStatus } from "@/lib/payments/constants";
import {
  authenticatePaymentWebhook,
  logWebhookAuthFailure,
  webhookEventFingerprint,
  type PaymentWebhookProvider,
} from "@/lib/payments/webhook-auth";

const TERMINAL_STATUSES = new Set(["paid", "failed", "refunded"]);

function mapBodyStatus(providerStatus: string) {
  const s = providerStatus.toLowerCase();
  if (["success", "paid", "completed", "approved"].includes(s)) {
    return mapProviderSuccessToPaymentStatus(true);
  }
  if (["failed", "cancelled", "canceled", "declined", "expired", "timeout"].includes(s)) {
    return "failed" as const;
  }
  return "pending" as const;
}

/**
 * Shared authenticated webhook handler for EVC / eDahab.
 * Verifies signature (fail-closed), then applies idempotent payment_status updates.
 */
export async function handlePaymentWebhook(
  req: NextRequest,
  provider: PaymentWebhookProvider
): Promise<NextResponse> {
  const rawBody = await req.text();

  const auth = authenticatePaymentWebhook(req, provider, rawBody);
  if (!auth.ok) {
    logWebhookAuthFailure(provider, auth.reason, req);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const payment = (body.payment as Record<string, unknown> | undefined) ?? undefined;
  const reference = String(
    body.reference ?? body.orderId ?? body.referenceId ?? payment?.reference_id ?? ""
  ).trim();
  const providerStatus = String(body.status ?? payment?.status ?? "").trim();
  const transactionIdRaw =
    body.transactionId ?? body.transaction_id ?? payment?.transaction_id ?? auth.eventId;
  const transactionId = transactionIdRaw != null ? String(transactionIdRaw) : null;

  if (!reference) {
    return NextResponse.json({ error: "Missing order reference" }, { status: 400 });
  }

  const paymentStatus = mapBodyStatus(providerStatus);
  const eventKey =
    auth.eventId ?? webhookEventFingerprint(provider, reference, paymentStatus, transactionId);
  const paymentReference = transactionId ?? eventKey;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("[payments] webhook accepted auth but Supabase env is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const supabase = createAdminClient();

  const { data: order, error: findError } = await supabase
    .from("orders")
    .select("id, payment_status, payment_reference")
    .eq("id", reference)
    .maybeSingle();

  if (findError || !order) {
    console.warn("[payments] webhook_order_not_found", {
      provider,
      reference,
      mode: auth.mode,
      eventId: auth.eventId,
      findError: findError?.message ?? null,
    });
    return NextResponse.json({ error: "Order not found for reference" }, { status: 404 });
  }

  // Idempotent replay: same provider reference already recorded.
  if (order.payment_reference && order.payment_reference === paymentReference) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Do not downgrade terminal payment states.
  if (TERMINAL_STATUSES.has(String(order.payment_status)) && paymentStatus !== order.payment_status) {
    return NextResponse.json({ received: true, ignored: true, reason: "terminal_state" });
  }

  // Already awaiting cashier with a different reference — treat as processed for this event key.
  if (
    order.payment_status === "pending_cashier_confirmation" &&
    paymentStatus === "pending_cashier_confirmation" &&
    order.payment_reference
  ) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: paymentStatus,
      payment_method: provider,
      payment_reference: paymentReference,
    })
    .eq("id", order.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
