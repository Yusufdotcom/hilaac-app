import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/verify-cron";

/**
 * GET /api/jobs/trial-expiration
 * Runs nightly via Vercel Cron. Any restaurant still on the 'trial' tier
 * whose subscription_end_date has passed is downgraded to 'starter' and
 * forced onto USSD-only payments (API access + AI tools are Pro-only), and
 * flagged 'expired' until they confirm a payment on /billing.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: expiredTrials, error: findError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("subscription_tier", "trial")
    .lt("subscription_end_date", new Date().toISOString());

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  if (!expiredTrials || expiredTrials.length === 0) {
    return NextResponse.json({ downgraded: 0 });
  }

  const ids = expiredTrials.map((r) => r.id);

  const { error: updateError } = await supabase
    .from("restaurants")
    .update({ subscription_tier: "starter", payment_mode: "ussd", subscription_status: "expired" })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ downgraded: ids.length });
}
