import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendOrderReadyWhatsApp } from "@/lib/whatsapp/send-order-ready";

/**
 * POST /api/notifications/whatsapp/order-ready
 * Body: { orderId }
 * Staff-authenticated; never blocks kitchen UI (fire-and-forget from client).
 * Failures are logged — always returns 200 with sent/skipped.
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

  const result = await sendOrderReadyWhatsApp(admin, orderId);
  return NextResponse.json(result);
}
