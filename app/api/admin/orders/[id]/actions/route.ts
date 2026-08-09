import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { isAwaitingCashierConfirmation } from "@/lib/payments/constants";
import { createAdminClient } from "@/lib/supabase/server";
import type { OrderStatus, PaymentStatus } from "@/types/database";

const ACTION_ROLES = ["owner", "manager", "cashier"] as const;
const MANUAL_STATUSES: OrderStatus[] = [
  "awaiting_payment",
  "new",
  "preparing",
  "ready",
  "delivered",
  "completed",
  "cancelled",
];

type ActionBody = {
  action?: unknown;
  reason?: unknown;
  status?: unknown;
  restaurant_id?: unknown;
};

/**
 * POST /api/admin/orders/[id]/actions
 * confirm_payment | cancel | update_status — owner/manager/cashier only.
 * Kitchen/waiter cannot call this (role gate). Writes order_action_log.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;
  if (!orderId) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  const auth = await requireActiveStaff({ roles: [...ACTION_ROLES] });
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;

  let body: ActionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!["confirm_payment", "cancel", "update_status"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 500)
      : null;

  if (action === "cancel" && (!reason || reason.length < 3)) {
    return NextResponse.json(
      { error: "Cancel reason required (min 3 characters)" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id, restaurant_id, status, payment_status, customer_confirmed_at, order_number"
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

  const previousStatus = order.status as OrderStatus;
  const previousPayment = order.payment_status as PaymentStatus;

  if (previousStatus === "cancelled" && action !== "update_status") {
    return NextResponse.json({ error: "Order is already cancelled" }, { status: 409 });
  }

  const update: { status?: OrderStatus; payment_status?: PaymentStatus } = {};

  if (action === "confirm_payment") {
    if (!isAwaitingCashierConfirmation(order) && previousPayment !== "pending") {
      return NextResponse.json(
        { error: "Order is not awaiting payment confirmation" },
        { status: 409 }
      );
    }
    update.payment_status = "paid";
    if (previousStatus === "awaiting_payment") {
      update.status = "new";
    }
  } else if (action === "cancel") {
    update.status = "cancelled";
    if (previousPayment !== "paid") {
      update.payment_status = "failed";
    }
  } else {
    const nextStatus = typeof body.status === "string" ? body.status : "";
    if (!MANUAL_STATUSES.includes(nextStatus as OrderStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (nextStatus === previousStatus) {
      return NextResponse.json({ ok: true, noop: true, order });
    }
    update.status = nextStatus as OrderStatus;
    if (nextStatus === "cancelled" && previousPayment !== "paid") {
      update.payment_status = "failed";
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .select("id, order_number, status, payment_status, updated_at")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Failed to update order" },
      { status: 500 }
    );
  }

  const { error: logError } = await admin.from("order_action_log").insert({
    restaurant_id: order.restaurant_id,
    order_id: orderId,
    action,
    reason,
    actor_id: user.id,
    previous_status: previousStatus,
    new_status: updated.status,
    previous_payment_status: previousPayment,
    new_payment_status: updated.payment_status,
  });

  if (logError) {
    console.error("[orders] action_log_failed", {
      orderId,
      action,
      actorId: user.id,
      error: logError.message,
    });
  }

  return NextResponse.json({
    ok: true,
    order: updated,
    action,
    actor_id: user.id,
  });
}
