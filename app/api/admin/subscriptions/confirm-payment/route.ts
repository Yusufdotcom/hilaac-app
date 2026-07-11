import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/subscriptions/confirm-payment
 * Manual USSD upgrade confirmation. The restaurant owner claims they've
 * dialed the Hilaac USSD payment code; this sets their subscription to
 * 'pro' for 30 days. (In production, reconcile this nightly against the
 * mobile money provider's settlement report.)
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId, method } = await req.json();

  const { data: profile } = await supabase.from("profiles").select("restaurant_id, role").eq("id", user.id).maybeSingle();

  if (!profile || profile.restaurant_id !== restaurantId || !["owner", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["evc", "edahab"].includes(method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  const { error } = await supabase
    .from("restaurants")
    .update({
      subscription_tier: "pro",
      subscription_status: "active",
      subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", restaurantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
