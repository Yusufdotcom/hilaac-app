import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  authorizeOrderAccess,
  extractOrderAccessToken,
} from "@/lib/payments/authorize-order-access";

/**
 * POST /api/orders/[id]/rating
 * Guest rates a delivered/completed order (1–5).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { rating?: number; accessToken?: string; chargeToken?: string } = {};
  try {
    body = await req.json();
  } catch {
    // token may be in header
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
  }

  const token = extractOrderAccessToken(
    req,
    body.accessToken ?? body.chargeToken ?? null
  );
  const auth = await authorizeOrderAccess({ orderId: params.id, token });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { data: order, error: fetchErr } = await admin
    .from("orders")
    .select("id, restaurant_id, status, customer_rating")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.restaurant_id !== auth.restaurantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (order.status !== "delivered" && order.status !== "completed") {
    return NextResponse.json(
      { error: "Rate after the order is delivered" },
      { status: 400 }
    );
  }

  if (order.customer_rating != null) {
    return NextResponse.json({
      ok: true,
      alreadyRated: true,
      rating: order.customer_rating,
    });
  }

  const { error } = await admin
    .from("orders")
    .update({
      customer_rating: rating,
      customer_rated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rating });
}
