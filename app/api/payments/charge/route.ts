import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { chargeEdahab, chargeEvc } from "@/lib/payments/providers";

/**
 * POST /api/payments/charge
 * Smart payment router used by the customer ordering flow when a restaurant
 * is on 'api' payment mode. Looks up the restaurant's encrypted credentials,
 * decrypts them in memory only, and calls the matching provider (EVC or
 * eDahab). Final confirmation still arrives asynchronously via
 * /api/webhooks/evc or /api/webhooks/edahab.
 */
export async function POST(req: NextRequest) {
  const { orderId, method, phone } = await req.json();

  if (!orderId || !["evc", "edahab"].includes(method)) {
    return NextResponse.json({ error: "orderId and a valid method are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, payment_mode, evc_merchant_id_encrypted, evc_api_key_encrypted, edahab_merchant_id_encrypted, edahab_api_key_encrypted")
    .eq("id", order.restaurant_id)
    .single();

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  if (restaurant.payment_mode !== "api") {
    return NextResponse.json({ error: "This restaurant does not accept direct API payments." }, { status: 400 });
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
    return NextResponse.json({ error: `${method.toUpperCase()} API credentials are not configured.` }, { status: 400 });
  }

  const chargeFn = method === "evc" ? chargeEvc : chargeEdahab;
  const result = await chargeFn({ merchantId, apiKey, amount: Number(order.total), phone: phone ?? order.customer_phone, reference: order.id });

  // Never log merchantId/apiKey — only the outcome.
  await supabase
    .from("orders")
    .update({
      payment_status: result.status,
      payment_method: method,
      payment_reference: result.providerReference ?? null,
    })
    .eq("id", orderId);

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Payment failed" }, { status: 502 });
  }

  return NextResponse.json({ success: true, status: result.status });
}
