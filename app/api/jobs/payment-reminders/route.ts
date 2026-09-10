import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/verify-cron";
import { sendPaymentReminder } from "@/lib/notifications/send-reminder";
import { resolveOwnerContact } from "@/lib/platform/resolve-owner-contact";
import { daysUntil } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Default: remind when subscription ends in exactly this many days. */
const REMINDER_DAYS = Number(process.env.SUBSCRIPTION_REMINDER_DAYS ?? 3) || 3;

/**
 * GET /api/jobs/payment-reminders
 * Daily cron. Finds active restaurants whose subscription ends in REMINDER_DAYS
 * and reminds the owner (email now; WhatsApp when REMINDER_WHATSAPP=true).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() + REMINDER_DAYS);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setHours(23, 59, 59, 999);

  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, owner_id, subscription_end_date, subscription_tier")
    .eq("subscription_status", "active")
    .not("owner_id", "is", null)
    .gte("subscription_end_date", windowStart.toISOString())
    .lte("subscription_end_date", windowEnd.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let remindersSent = 0;
  let skipped = 0;
  const results: { restaurantId: string; ok: boolean; reason?: string }[] = [];

  for (const restaurant of restaurants ?? []) {
    if (!restaurant.owner_id) {
      skipped += 1;
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
    } else {
      results.push({ restaurantId: restaurant.id, ok: false, reason: send.reason });
    }
  }

  console.info("[jobs] payment_reminders", {
    reminderDays: REMINDER_DAYS,
    checked: restaurants?.length ?? 0,
    remindersSent,
    skipped,
  });

  return NextResponse.json({
    reminderDays: REMINDER_DAYS,
    remindersSent,
    skipped,
    restaurantsChecked: restaurants?.length ?? 0,
    results,
  });
}
