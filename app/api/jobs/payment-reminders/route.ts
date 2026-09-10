import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/verify-cron";
import { sendPaymentReminder } from "@/lib/notifications/send-reminder";
import { resolveOwnerContact } from "@/lib/platform/resolve-owner-contact";
import { daysUntil } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Remind when subscription ends within this many days (inclusive of today→end). */
const REMINDER_WINDOW_DAYS = Number(process.env.SUBSCRIPTION_REMINDER_DAYS ?? 7) || 7;
/** Skip if we already reminded within this many hours (dedupe). */
const REMINDER_COOLDOWN_HOURS = Number(process.env.SUBSCRIPTION_REMINDER_COOLDOWN_HOURS ?? 144) || 144;

/**
 * GET /api/jobs/payment-reminders
 * Daily cron. Finds active restaurants whose subscription ends within REMINDER_WINDOW_DAYS
 * and reminds the owner (email via Resend; WhatsApp when REMINDER_WHATSAPP=true).
 * Skips restaurants with a recent last_subscription_reminder_at to avoid duplicates.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + REMINDER_WINDOW_DAYS);
  windowEnd.setHours(23, 59, 59, 999);

  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select(
      "id, name, slug, owner_id, subscription_end_date, subscription_tier, last_subscription_reminder_at"
    )
    .eq("subscription_status", "active")
    .not("owner_id", "is", null)
    .gte("subscription_end_date", now.toISOString())
    .lte("subscription_end_date", windowEnd.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let remindersSent = 0;
  let skipped = 0;
  const results: { restaurantId: string; ok: boolean; reason?: string }[] = [];
  const cooldownMs = REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;

  for (const restaurant of restaurants ?? []) {
    if (!restaurant.owner_id) {
      skipped += 1;
      continue;
    }

    const last = restaurant.last_subscription_reminder_at
      ? new Date(restaurant.last_subscription_reminder_at).getTime()
      : 0;
    if (last && Date.now() - last < cooldownMs) {
      skipped += 1;
      results.push({ restaurantId: restaurant.id, ok: false, reason: "already_reminded" });
      continue;
    }

    const contact = await resolveOwnerContact(supabase, {
      ownerId: restaurant.owner_id,
      restaurantId: restaurant.id,
    });

    if (!contact.email) {
      skipped += 1;
      results.push({ restaurantId: restaurant.id, ok: false, reason: "no_owner_email" });
      continue;
    }

    const days = daysUntil(restaurant.subscription_end_date);
    const send = await sendPaymentReminder(
      {
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        plan: restaurant.subscription_tier,
        subscriptionEndDate: restaurant.subscription_end_date,
        daysRemaining: days,
        ownerName: contact.ownerName,
        email: contact.email,
        phone: contact.phone,
      },
      { allowDryRun: true }
    );
    if (send.sent || send.dryRun) {
      remindersSent += 1;
      results.push({ restaurantId: restaurant.id, ok: true, reason: send.reason });
      if (send.sent) {
        await supabase
          .from("restaurants")
          .update({ last_subscription_reminder_at: new Date().toISOString() })
          .eq("id", restaurant.id);
      }
    } else {
      results.push({ restaurantId: restaurant.id, ok: false, reason: send.reason });
    }
  }

  console.info("[jobs] payment_reminders", {
    reminderWindowDays: REMINDER_WINDOW_DAYS,
    checked: restaurants?.length ?? 0,
    remindersSent,
    skipped,
  });

  return NextResponse.json({
    reminderWindowDays: REMINDER_WINDOW_DAYS,
    remindersSent,
    skipped,
    restaurantsChecked: restaurants?.length ?? 0,
    results,
  });
}
