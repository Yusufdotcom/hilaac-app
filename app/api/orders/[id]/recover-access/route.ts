import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeLoyaltyPhone } from "@/lib/loyalty/phone";
import { mintOrderAccessToken } from "@/lib/payments/charge-token";
import {
  clientIpFromRequest,
  isRecoverAccessRateLimited,
} from "@/lib/payments/recover-order-access-rate-limit";

/**
 * POST /api/orders/[id]/recover-access
 * Remint a tracking access token after the customer re-enters the phone
 * used on the order. UUID alone is never enough (H2).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const orderId = params.id?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const ip = clientIpFromRequest(req);
  if (isRecoverAccessRateLimited(ip, orderId)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  let body: { phone?: string | null };
  try {
    body = (await req.json()) as { phone?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const submitted = normalizeLoyaltyPhone(body.phone);
  if (!submitted) {
    return NextResponse.json(
      { error: "Enter the phone number used when you placed this order." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, restaurant_id, customer_phone, created_at")
    .eq("id", orderId)
    .maybeSingle();

  // Same generic failure for missing order / wrong phone (no enumeration).
  const deny = () =>
    NextResponse.json(
      { error: "Phone number does not match this order." },
      { status: 401 }
    );

  if (error || !order) {
    return deny();
  }

  const stored = normalizeLoyaltyPhone(order.customer_phone);
  if (!stored || !phonesMatch(submitted, stored)) {
    console.warn("[orders] recover_access_denied", {
      reason: stored ? "phone_mismatch" : "no_phone_on_order",
      orderId,
    });
    return deny();
  }

  // Only remint for relatively recent dining sessions (7 days).
  const createdMs = order.created_at ? Date.parse(order.created_at) : NaN;
  if (Number.isFinite(createdMs) && Date.now() - createdMs > 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "This order is too old to reopen status tracking." },
      { status: 410 }
    );
  }

  let accessToken: string;
  try {
    accessToken = mintOrderAccessToken(order.id, order.restaurant_id);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[orders] recover_access_mint_failed", { orderId, reason });
    return NextResponse.json(
      {
        error: "Unable to restore order access.",
        code: "mint_failed",
        // Safe to expose: only whether secret is configured, not the secret itself.
        detail: reason.includes("CHARGE_TOKEN_SECRET")
          ? "CHARGE_TOKEN_SECRET is not configured on the server"
          : "token_mint_error",
      },
      { status: 503 }
    );
  }

  console.info("[orders] recover_access_ok", { orderId });
  return NextResponse.json({ accessToken });
}

function phonesMatch(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
