import { NextRequest, NextResponse } from "next/server";
import { generateAndStoreOrderStatusMessage } from "@/lib/ai/order-status-message";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/notifications/order-status-message
 * Body: { orderId }
 * Staff-authenticated; fire-and-forget from kitchen/waiter boards.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("restaurant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile?.restaurant_id ||
    !["owner", "manager", "kitchen", "cashier", "waiter"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, restaurant_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.restaurant_id !== profile.restaurant_id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const message = await generateAndStoreOrderStatusMessage(admin, orderId);
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    console.error("[order-status-message]", err);
    return NextResponse.json({ ok: false, message: null });
  }
}
