import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { nextSubscriptionEndDate } from "@/lib/platform/subscription-renewal";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/platform/renewals/[id]/confirm
 * Platform Super Admin only — mirrors cashier confirm-payment for SaaS renewals.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  const renewalId = params.id?.trim();
  if (!renewalId) {
    return NextResponse.json({ error: "Renewal id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: renewal, error: loadErr } = await admin
    .from("subscription_renewals")
    .select("id, restaurant_id, tier, status, amount, method")
    .eq("id", renewalId)
    .maybeSingle();

  if (loadErr || !renewal) {
    return NextResponse.json({ error: "Renewal not found" }, { status: 404 });
  }

  if (renewal.status !== "pending_confirmation") {
    return NextResponse.json(
      { error: "Renewal is not awaiting confirmation", code: "not_pending" },
      { status: 409 }
    );
  }

  const { data: restaurant, error: restErr } = await admin
    .from("restaurants")
    .select("id, subscription_end_date, subscription_tier")
    .eq("id", renewal.restaurant_id)
    .maybeSingle();

  if (restErr || !restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const nextEnd = nextSubscriptionEndDate(restaurant.subscription_end_date);
  const tier =
    renewal.tier === "pro" || renewal.tier === "starter" ? renewal.tier : "starter";

  const { error: updateRestErr } = await admin
    .from("restaurants")
    .update({
      subscription_tier: tier,
      subscription_status: "active",
      subscription_end_date: nextEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", restaurant.id);

  if (updateRestErr) {
    return NextResponse.json({ error: updateRestErr.message }, { status: 500 });
  }

  const { error: updateRenewalErr } = await admin
    .from("subscription_renewals")
    .update({
      status: "confirmed",
      confirmed_by: auth.user.id,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", renewal.id)
    .eq("status", "pending_confirmation");

  if (updateRenewalErr) {
    return NextResponse.json({ error: updateRenewalErr.message }, { status: 500 });
  }

  console.info("[platform] renewal_confirmed", {
    renewalId: renewal.id,
    restaurantId: restaurant.id,
    tier,
    amount: renewal.amount,
    method: renewal.method,
    confirmedBy: auth.user.id,
    subscriptionEndDate: nextEnd,
  });

  return NextResponse.json({
    success: true,
    subscription_tier: tier,
    subscription_status: "active",
    subscription_end_date: nextEnd,
  });
}
