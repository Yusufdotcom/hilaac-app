import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/packages/checkin
 * Body: { pass_code, slug? }
 * Owner / manager / cashier — unique day check-in + buffet capacity.
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager", "cashier"] });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const passCode = String(body.pass_code ?? "")
    .trim()
    .toUpperCase();
  if (!passCode) {
    return NextResponse.json({ error: "pass_code is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const restaurantId = auth.profile.restaurant_id!;

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, subscription_tier")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "ramadan_packages")) {
    return NextResponse.json(
      { error: "Somali Airlines 1.0 feature", code: "tier_gated", gated: true },
      { status: 403 }
    );
  }

  const { data: subscription } = await admin
    .from("ramadan_subscriptions")
    .select("id, package_id, restaurant_id, customer_name, payment_status, pass_code")
    .eq("pass_code", passCode)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json({ error: "Pass code not found" }, { status: 404 });
  }
  if (subscription.payment_status !== "paid") {
    return NextResponse.json(
      { error: `Subscription payment is ${subscription.payment_status}` },
      { status: 400 }
    );
  }

  const { data: pkg } = await admin
    .from("ramadan_packages")
    .select("id, name, type, max_daily_capacity, is_active, valid_from, valid_to")
    .eq("id", subscription.package_id)
    .maybeSingle();

  if (!pkg || !pkg.is_active) {
    return NextResponse.json({ error: "Package is not active" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (today < pkg.valid_from || today > pkg.valid_to) {
    return NextResponse.json({ error: "Package is outside its valid dates" }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("ramadan_checkins")
    .select("id")
    .eq("subscription_id", subscription.id)
    .eq("checkin_date", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Already checked in today", code: "already_checked_in" },
      { status: 409 }
    );
  }

  if (pkg.type === "buffet" && pkg.max_daily_capacity != null && pkg.max_daily_capacity > 0) {
    const { count } = await admin
      .from("ramadan_checkins")
      .select("id", { count: "exact", head: true })
      .eq("package_id", pkg.id)
      .eq("checkin_date", today);

    if ((count ?? 0) >= pkg.max_daily_capacity) {
      return NextResponse.json(
        { error: "Buffet daily capacity reached", code: "capacity_full" },
        { status: 409 }
      );
    }
  }

  const { data: checkin, error } = await admin
    .from("ramadan_checkins")
    .insert({
      subscription_id: subscription.id,
      package_id: pkg.id,
      restaurant_id: restaurantId,
      checkin_date: today,
      confirmed_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Already checked in today", code: "already_checked_in" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    checkin,
    customer_name: subscription.customer_name,
    package_name: pkg.name,
  });
}
