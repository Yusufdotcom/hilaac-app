import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_LOYALTY_ROLES, getLoyaltyStaffContext } from "@/lib/loyalty/staff-auth";

/**
 * GET /api/admin/loyalty/settings?slug=
 * PATCH /api/admin/loyalty/settings  { slug, enabled, target_order_count, reward_description }
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const ctx = await getLoyaltyStaffContext(slug, ADMIN_LOYALTY_ROLES);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const [{ data: settings }, progressCount, rewardCount, redemptionsCount] = await Promise.all([
    admin
      .from("loyalty_settings")
      .select("restaurant_id, enabled, target_order_count, reward_description, created_at, updated_at")
      .eq("restaurant_id", ctx.restaurant.id)
      .maybeSingle(),
    admin
      .from("loyalty_progress")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", ctx.restaurant.id)
      .gt("current_count", 0),
    admin
      .from("loyalty_progress")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", ctx.restaurant.id)
      .gt("available_rewards", 0),
    admin
      .from("loyalty_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", ctx.restaurant.id),
  ]);

  // Also count customers who only have rewards (current_count may be 0).
  const { count: anyProgress } = await admin
    .from("loyalty_progress")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", ctx.restaurant.id)
    .or("current_count.gt.0,available_rewards.gt.0");

  return NextResponse.json({
    settings: settings ?? {
      restaurant_id: ctx.restaurant.id,
      enabled: false,
      target_order_count: 5,
      reward_description: "Free item",
    },
    stats: {
      customers_with_progress: anyProgress ?? progressCount.count ?? 0,
      customers_with_rewards: rewardCount.count ?? 0,
      total_redemptions: redemptionsCount.count ?? 0,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const ctx = await getLoyaltyStaffContext(slug, ADMIN_LOYALTY_ROLES);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const enabled = Boolean(body.enabled);
  const target = Math.floor(Number(body.target_order_count));
  const rewardDescription = String(body.reward_description ?? "").trim();

  if (!Number.isFinite(target) || target < 2 || target > 100) {
    return NextResponse.json(
      { error: "Target order count must be between 2 and 100." },
      { status: 400 }
    );
  }
  if (!rewardDescription || rewardDescription.length > 120) {
    return NextResponse.json(
      { error: "Reward description is required (max 120 characters)." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("loyalty_settings")
    .upsert(
      {
        restaurant_id: ctx.restaurant.id,
        enabled,
        target_order_count: target,
        reward_description: rewardDescription,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id" }
    )
    .select("restaurant_id, enabled, target_order_count, reward_description, created_at, updated_at")
    .single();

  if (error) {
    console.error("[loyalty] settings upsert failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
