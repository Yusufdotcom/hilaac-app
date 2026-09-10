import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/verify-cron";
import { sendWhatsAppText } from "@/lib/whatsapp/twilio";
import { toWhatsAppAddress } from "@/lib/whatsapp/phone";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function addDaysIso(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/jobs/event-reminders
 * Daily cron:
 * - 7 days before: balance reminder if not fully paid
 * - 48 hours before (~2 days): event details reminder
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date();
  const in7 = addDaysIso(today, 7);
  const in2 = addDaysIso(today, 2);

  let sent7 = 0;
  let sent48 = 0;
  let skipped = 0;
  let failed = 0;

  const { data: weekOut } = await admin
    .from("event_bookings")
    .select(
      "id, restaurant_id, contact_name, contact_phone, event_name, event_type, event_date, start_time, guest_count, total_price, deposit_paid, balance_due_date, reminder_7d_sent_at, restaurants!inner(name)"
    )
    .eq("event_date", in7)
    .in("status", ["inquiry", "confirmed"])
    .is("reminder_7d_sent_at", null);

  for (const booking of weekOut ?? []) {
    const total = Number(booking.total_price ?? 0);
    const deposit = Number(booking.deposit_paid ?? 0);
    const balance = Math.max(0, total - deposit);
    if (total > 0 && balance <= 0) {
      skipped += 1;
      continue;
    }

    const to = toWhatsAppAddress(booking.contact_phone);
    if (!to) {
      skipped += 1;
      continue;
    }

    const restaurantName =
      booking.restaurants && typeof booking.restaurants === "object" && "name" in booking.restaurants
        ? String((booking.restaurants as { name?: string }).name ?? "your venue")
        : "your venue";
    const label = booking.event_name || booking.event_type;
    const body = [
      `Reminder from ${restaurantName}:`,
      `Your ${label} is in 7 days (${booking.event_date}).`,
      balance > 0
        ? `Balance remaining: ${formatCurrency(balance)}.`
        : "Please confirm your booking details with us.",
      booking.balance_due_date ? `Balance due by ${booking.balance_due_date}.` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await sendWhatsAppText({ toWhatsApp: to, body });
    if (!result.ok) {
      failed += 1;
      continue;
    }

    await admin
      .from("event_bookings")
      .update({ reminder_7d_sent_at: new Date().toISOString() })
      .eq("id", booking.id);
    sent7 += 1;
  }

  const { data: twoDays } = await admin
    .from("event_bookings")
    .select(
      "id, contact_name, contact_phone, event_name, event_type, event_date, start_time, guest_count, notes, reminder_48h_sent_at, restaurants!inner(name)"
    )
    .eq("event_date", in2)
    .in("status", ["inquiry", "confirmed"])
    .is("reminder_48h_sent_at", null);

  for (const booking of twoDays ?? []) {
    const to = toWhatsAppAddress(booking.contact_phone);
    if (!to) {
      skipped += 1;
      continue;
    }

    const restaurantName =
      booking.restaurants && typeof booking.restaurants === "object" && "name" in booking.restaurants
        ? String((booking.restaurants as { name?: string }).name ?? "your venue")
        : "your venue";
    const label = booking.event_name || booking.event_type;
    const time = booking.start_time ? String(booking.start_time).slice(0, 5) : null;
    const body = [
      `Reminder from ${restaurantName}:`,
      `Your ${label} is in 2 days (${booking.event_date}${time ? ` at ${time}` : ""}).`,
      booking.guest_count != null ? `Guests: ${booking.guest_count}.` : null,
      booking.notes ? `Notes: ${booking.notes}` : null,
      "We look forward to hosting you.",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await sendWhatsAppText({ toWhatsApp: to, body });
    if (!result.ok) {
      failed += 1;
      continue;
    }

    await admin
      .from("event_bookings")
      .update({ reminder_48h_sent_at: new Date().toISOString() })
      .eq("id", booking.id);
    sent48 += 1;
  }

  return NextResponse.json({
    ok: true,
    sent_7d: sent7,
    sent_48h: sent48,
    skipped,
    failed,
    targets: { in7, in2 },
  });
}
