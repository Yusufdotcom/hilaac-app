import { NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments/process-webhook";

/**
 * POST /api/webhooks/edahab
 * Authenticated webhook (HMAC). Rejects unsigned / invalid payloads with 401.
 */
export async function POST(req: NextRequest) {
  return handlePaymentWebhook(req, "edahab");
}
