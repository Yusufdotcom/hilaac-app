import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

const ACCEPT_ROLES = ["owner", "manager", "waiter", "cashier"] as const;
const ACCEPTABLE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

/**
 * POST /api/staff/orders/[id]/accept
 * Waiter or cashier (or owner/manager) confirms guest presence.
 * Idempotent — never touches payment_status or advances status.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;
  if (!orderId) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  const auth = await requireActiveStaff({ roles: [...ACCEPT_ROLES] });
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const actorName =
    (typeof actorProfile?.full_name === "string" && actorProfile.full_name.trim()) ||
    (typeof actorProfile?.phone === "string" && actorProfile.phone.trim()) ||
    "Staff";

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id, restaurant_id, status, payment_status, accepted_at, accepted_by, order_number"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", order.restaurant_id)
    .maybeSingle();

  const isOwner = profile.role === "owner" && restaurant?.owner_id === user.id;
  const isPrimary = profile.restaurant_id === order.restaurant_id;
  if (!isOwner && !isPrimary) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!ACCEPTABLE_STATUSES.includes(order.status as OrderStatus)) {
    return NextResponse.json(
      { error: "Order cannot be accepted in its current status" },
      { status: 409 }
    );
  }

  if (order.accepted_at) {
    return NextResponse.json({
      ok: true,
      alreadyAccepted: true,
      order: {
        id: order.id,
        accepted_at: order.accepted_at,
        accepted_by: order.accepted_by,
        status: order.status,
        payment_status: order.payment_status,
      },
    });
  }

  const acceptedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await admin
    .from("orders")
    .update({
      accepted_at: acceptedAt,
      accepted_by: actorName,
    })
    .eq("id", orderId)
    .is("accepted_at", null)
    .select("id, accepted_at, accepted_by, status, payment_status")
    .maybeSingle();

  if (updateError) {
    console.error("[orders] accept_failed", updateError.message);
    return NextResponse.json({ error: "Failed to accept order" }, { status: 500 });
  }

  if (!updated) {
    // Race: someone else accepted first
    const { data: latest } = await admin
      .from("orders")
      .select("id, accepted_at, accepted_by, status, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      alreadyAccepted: true,
      order: latest ?? {
        id: order.id,
        accepted_at: order.accepted_at,
        accepted_by: order.accepted_by,
        status: order.status,
        payment_status: order.payment_status,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    alreadyAccepted: false,
    order: updated,
  });
}
