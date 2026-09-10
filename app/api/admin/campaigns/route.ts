import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { normalizePromoCode } from "@/lib/campaigns/promo";

export const dynamic = "force-dynamic";

async function loadRestaurant(restaurantId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurants")
    .select("id, subscription_tier")
    .eq("id", restaurantId)
    .maybeSingle();
  return data;
}

/** GET /api/admin/campaigns */
export async function GET() {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const restaurant = await loadRestaurant(auth.profile.restaurant_id!);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "campaign_codes_basic")) {
    return NextResponse.json({ error: "Feature gated", gated: true }, { status: 403 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const canAnalytics = canUseFeature(restaurant.subscription_tier, "campaign_analytics");
  let analytics: Record<
    string,
    { redemptions: number; discount_given: number; revenue: number }
  > = {};

  if (canAnalytics && (data?.length ?? 0) > 0) {
    const ids = (data ?? []).map((c) => c.id);
    const { data: redemptions } = await supabase
      .from("campaign_redemptions")
      .select("campaign_id, discount_applied, order_total_after")
      .eq("restaurant_id", restaurant.id)
      .in("campaign_id", ids);

    for (const row of redemptions ?? []) {
      const key = row.campaign_id as string;
      const cur = analytics[key] ?? { redemptions: 0, discount_given: 0, revenue: 0 };
      cur.redemptions += 1;
      cur.discount_given += Number(row.discount_applied ?? 0) || 0;
      cur.revenue += Number(row.order_total_after ?? 0) || 0;
      analytics[key] = cur;
    }
  }

  return NextResponse.json({
    campaigns: data ?? [],
    analytics: canAnalytics ? analytics : null,
    canAnalytics,
  });
}

/** POST /api/admin/campaigns — create */
export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const restaurant = await loadRestaurant(auth.profile.restaurant_id!);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "campaign_codes_basic")) {
    return NextResponse.json({ error: "Feature gated", gated: true }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const code = normalizePromoCode(String(body.code ?? ""));
  const discountType = body.discount_type === "fixed" ? "fixed" : "percentage";
  const discountValue = Number(body.discount_value);
  const validFrom = String(body.valid_from ?? "").trim();
  const validTo = String(body.valid_to ?? "").trim();
  const maxUses =
    body.max_uses != null && body.max_uses !== "" ? Number(body.max_uses) : null;
  const minOrder =
    body.min_order_amount != null && body.min_order_amount !== ""
      ? Number(body.min_order_amount)
      : null;

  if (!name || !code || !validFrom || !validTo || !(discountValue > 0)) {
    return NextResponse.json(
      { error: "name, code, discount_value, valid_from, and valid_to are required" },
      { status: 400 }
    );
  }
  if (discountType === "percentage" && discountValue > 100) {
    return NextResponse.json({ error: "Percentage cannot exceed 100" }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      restaurant_id: restaurant.id,
      name,
      code,
      discount_type: discountType,
      discount_value: discountValue,
      valid_from: validFrom,
      valid_to: validTo,
      max_uses: maxUses != null && maxUses > 0 ? maxUses : null,
      min_order_amount: minOrder != null && minOrder >= 0 ? minOrder : null,
      is_active: body.is_active !== false,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) {
    const msg = error.message.includes("campaigns_restaurant_code_unique")
      ? "That promo code already exists"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ campaign: data }, { status: 201 });
}

/** PATCH /api/admin/campaigns — toggle active */
export async function PATCH(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const restaurant = await loadRestaurant(auth.profile.restaurant_id!);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "campaign_codes_basic")) {
    return NextResponse.json({ error: "Feature gated", gated: true }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") update.is_active = body.is_active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaigns")
    .update(update)
    .eq("id", id)
    .eq("restaurant_id", restaurant.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}
