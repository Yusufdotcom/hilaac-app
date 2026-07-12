import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/verify-cron";
import { sendPaymentReminder } from "@/lib/notifications/send-reminder";

export const dynamic = 'force-dynamic';
/**
 * GET /api/jobs/payment-reminders
 * Runs daily via Vercel Cron. Finds restaurants whose subscription expires
 * in exactly 3 days and sends the owner an SMS/WhatsApp reminder.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() + 3);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setHours(23, 59, 59, 999);

  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("id, name, subscription_end_date")
    .eq("subscription_status", "active")
    .gte("subscription_end_date", windowStart.toISOString())
    .lte("subscription_end_date", windowEnd.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let remindersSent = 0;

  for (const restaurant of restaurants ?? []) {
    const { data: owner } = await supabase
      .from("profiles")
      .select("phone")
      .eq("restaurant_id", restaurant.id)
      .eq("role", "owner")
      .maybeSingle();

    if (owner?.phone) {
      await sendPaymentReminder(owner.phone, restaurant.name, 3);
      remindersSent += 1;
    }
  }

  return NextResponse.json({ remindersSent, restaurantsChecked: restaurants?.length ?? 0 });
}
