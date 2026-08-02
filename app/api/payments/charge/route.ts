import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { mapProviderSuccessToPaymentStatus } from "@/lib/payments/constants";
import { verifyChargeToken } from "@/lib/payments/charge-token";
import { authorizeOrderAccess } from "@/lib/payments/authorize-order-access";
import { chargeEdahab, chargeEvc } from "@/lib/payments/providers";

/**
 * POST /api/payments/charge
 * Requires either:
 *  - a short-lived chargeToken minted at order creation (customer QR flow), or
 *  - an authenticated staff session for the order's restaurant.
 * Merchant credentials are decrypted only after authorization succeeds.
 */
export async function POST(req: NextRequest) {
  let body: {
    orderId?: string;
    method?: string;
    phone?: string | null;
    chargeToken?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { orderId, method, phone } = body;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const chargeToken = body.chargeToken ?? bearer ?? null;

  if (!orderId || !["evc", "edahab"].includes(String(method))) {
    return NextResponse.json({ error: "orderId and a valid method are required" }, { status: 400 });
  }

  const auth = await authorizeOrderAccess({ orderId, token: chargeToken });
  if (!auth.ok) {
    console.warn("[payments] charge_auth_failed", {
      reason: auth.reason,
      orderId,
    });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Authorized — only now use the service role / decrypt merchant credentials.
  const supabase = createAdminClient();

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.restaurant_id !== auth.restaurantId) {
    console.warn("[payments] charge_auth_failed", {
      reason: "restaurant_mismatch",
      orderId,
      via: auth.via,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (auth.via === "order_token") {
    const bound = verifyChargeToken(chargeToken, {
      orderId: order.id,
      restaurantId: order.restaurant_id,
    });
    if (!bound.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select(
      "id, payment_mode, evc_merchant_id_encrypted, evc_api_key_encrypted, edahab_merchant_id_encrypted, edahab_api_key_encrypted"
    )
    .eq("id", order.restaurant_id)
    .single();

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  if (restaurant.payment_mode !== "api") {
    return NextResponse.json(
      { error: "This restaurant does not accept direct API payments." },
      { status: 400 }
    );
  }

  let merchantId: string | null = null;
  let apiKey: string | null = null;

  try {
    if (method === "evc") {
      merchantId = decrypt(restaurant.evc_merchant_id_encrypted);
      apiKey = decrypt(restaurant.evc_api_key_encrypted);
    } else {
      merchantId = decrypt(restaurant.edahab_merchant_id_encrypted);
      apiKey = decrypt(restaurant.edahab_api_key_encrypted);
    }
  } catch {
    return NextResponse.json({ error: "Could not decrypt merchant credentials." }, { status: 500 });
  }

  if (!merchantId || !apiKey) {
    return NextResponse.json(
      { error: `${String(method).toUpperCase()} API credentials are not configured.` },
      { status: 400 }
    );
  }

  const chargeFn = method === "evc" ? chargeEvc : chargeEdahab;
  const result = await chargeFn({
    merchantId,
    apiKey,
    amount: Number(order.total),
    phone: phone ?? order.customer_phone,
    reference: order.id,
  });

  const paymentStatus = mapProviderSuccessToPaymentStatus(result.success);

  await supabase
    .from("orders")
    .update({
      payment_status: paymentStatus,
      payment_method: method,
      payment_reference: result.providerReference ?? null,
    })
    .eq("id", orderId);

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Payment failed" }, { status: 502 });
  }

  return NextResponse.json({ success: true, status: paymentStatus });
}
