import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { availableCredit, type DeynAccountRow } from "@/lib/deyn/codes";
import { sendWhatsAppText } from "@/lib/whatsapp/twilio";
import { toWhatsAppAddress } from "@/lib/whatsapp/phone";
import { formatCurrency } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

const ACCEPT_ROLES = ["owner", "manager", "waiter", "cashier"] as const;
const ACCEPTABLE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

/**
 * POST /api/staff/orders/[id]/accept
 * Waiter or cashier (or owner/manager) confirms guest presence.
 * For Deyn orders: charges the account (with optional limit override).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;
  if (!orderId) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  const auth = await requireActiveStaff({ roles: [...ACCEPT_ROLES] });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const overrideDeynLimit = body.override_deyn_limit === true;

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
      "id, restaurant_id, status, payment_status, payment_method, accepted_at, accepted_by, order_number, total, deyn_code, deyn_account_id, customer_phone"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, owner_id")
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

  let deynAccount: DeynAccountRow | null = null;
  const isDeyn = order.payment_method === "deyn" && order.deyn_account_id;

  if (isDeyn) {
    const { data: account } = await admin
      .from("deyn_accounts")
      .select("*")
      .eq("id", order.deyn_account_id!)
      .eq("restaurant_id", order.restaurant_id)
      .maybeSingle();

    if (!account || !account.is_active) {
      return NextResponse.json({ error: "Deyn account not found or inactive" }, { status: 400 });
    }

    deynAccount = account as DeynAccountRow;
    const available = availableCredit(deynAccount);
    const needed = Number(order.total) || 0;

    if (needed > available + 1e-9 && !overrideDeynLimit) {
      return NextResponse.json(
        {
          error: `Insufficient credit ($${available.toFixed(2)} available, $${needed.toFixed(2)} needed)`,
          code: "deyn_limit",
          available,
          needed,
          customer_name: deynAccount.customer_name,
          deyn_code: deynAccount.deyn_code,
          can_override: true,
        },
        { status: 409 }
      );
    }
  }

  const acceptedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await admin
    .from("orders")
    .update({
      accepted_at: acceptedAt,
      accepted_by: actorName,
      ...(isDeyn ? { payment_status: "paid" } : {}),
    })
    .eq("id", orderId)
    .is("accepted_at", null)
    .select("id, accepted_at, accepted_by, status, payment_status, payment_method, deyn_code, deyn_account_id, total")
    .maybeSingle();

  if (updateError) {
    console.error("[orders] accept_failed", updateError.message);
    return NextResponse.json({ error: "Failed to accept order" }, { status: 500 });
  }

  if (!updated) {
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

  if (isDeyn && deynAccount) {
    const amount = Number(order.total) || 0;
    const override =
      overrideDeynLimit && amount > availableCredit(deynAccount) + 1e-9;

    await admin.from("deyn_transactions").insert({
      restaurant_id: order.restaurant_id,
      deyn_account_id: deynAccount.id,
      order_id: order.id,
      transaction_type: "charge",
      amount,
      note: override ? "Accepted with credit-limit override" : null,
      override_limit: override,
      created_by: user.id,
    });

    const newBalance = Number(deynAccount.balance) + amount;
    await admin
      .from("deyn_accounts")
      .update({ balance: newBalance })
      .eq("id", deynAccount.id);

    const remaining = Math.max(0, Number(deynAccount.credit_limit) - newBalance);
    const phone = deynAccount.customer_phone || order.customer_phone;
    const to = toWhatsAppAddress(phone);
    if (to && restaurant?.name) {
      await sendWhatsAppText({
        toWhatsApp: to,
        body: [
          `Order accepted at ${restaurant.name}.`,
          `${formatCurrency(amount)} charged to your Deyn account.`,
          `Remaining balance: ${formatCurrency(remaining)}.`,
        ].join(" "),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    alreadyAccepted: false,
    order: updated,
  });
}
