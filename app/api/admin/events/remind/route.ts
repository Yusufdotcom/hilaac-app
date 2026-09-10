import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createAdminClient } from "@/lib/supabase/server";
import { sendWhatsAppText } from "@/lib/whatsapp/twilio";
import { toWhatsAppAddress } from "@/lib/whatsapp/phone";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/events/remind
 * Manual WhatsApp reminder for balance / event details.
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, subscription_tier")
    .eq("id", auth.profile.restaurant_id!)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "event_hall_management")) {
    return NextResponse.json(
      { error: "Somali Airlines 1.0 feature", code: "tier_gated", gated: true },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: booking } = await admin
    .from("event_bookings")
    .select(
      "id, contact_name, contact_phone, event_name, event_type, event_date, start_time, guest_count, total_price, deposit_paid, balance_due_date"
    )
    .eq("id", id)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const to = toWhatsAppAddress(booking.contact_phone);
  if (!to) {
    return NextResponse.json({ error: "Invalid contact phone" }, { status: 400 });
  }

  const total = Number(booking.total_price ?? 0);
  const deposit = Number(booking.deposit_paid ?? 0);
  const balance = Math.max(0, total - deposit);
  const label = booking.event_name || booking.event_type;
  const time = booking.start_time ? String(booking.start_time).slice(0, 5) : null;

  const lines = [
    `Reminder from ${restaurant.name}:`,
    `Your ${label} on ${booking.event_date}${time ? ` at ${time}` : ""}.`,
    booking.guest_count != null ? `Guests: ${booking.guest_count}.` : null,
    total > 0
      ? `Balance remaining: ${formatCurrency(balance)} (total ${formatCurrency(total)}, deposit ${formatCurrency(deposit)}).`
      : null,
    booking.balance_due_date ? `Balance due by ${booking.balance_due_date}.` : null,
    "Reply if you need to change anything.",
  ].filter(Boolean);

  const result = await sendWhatsAppText({ toWhatsApp: to, body: lines.join("\n") });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, dryRun: result.dryRun });
}
