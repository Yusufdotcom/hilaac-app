import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseAiFeatures, canUseApiPayments } from "@/lib/constants";
import { daysUntil } from "@/lib/utils";

/**
 * GET /api/admin/restaurant/status
 * Returns the current restaurant's subscription tier/status so the UI can
 * lock Pro-only features (AI generator, API payments) without re-fetching
 * the full restaurant row.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("restaurant_id").eq("id", user.id).maybeSingle();
  if (!profile?.restaurant_id) return NextResponse.json({ error: "No restaurant linked" }, { status: 404 });

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("subscription_tier, subscription_status, subscription_end_date, payment_mode")
    .eq("id", profile.restaurant_id)
    .single();

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  return NextResponse.json({
    subscriptionTier: restaurant.subscription_tier,
    subscriptionStatus: restaurant.subscription_status,
    subscriptionEndDate: restaurant.subscription_end_date,
    daysRemaining: daysUntil(restaurant.subscription_end_date),
    paymentMode: restaurant.payment_mode,
    canUseAi: canUseAiFeatures(restaurant.subscription_tier),
    canUseApiPayments: canUseApiPayments(restaurant.subscription_tier),
  });
}
