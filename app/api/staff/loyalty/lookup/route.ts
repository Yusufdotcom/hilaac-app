import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeLoyaltyPhone } from "@/lib/loyalty/phone";
import { getLoyaltyStaffContext } from "@/lib/loyalty/staff-auth";

/**
 * POST /api/staff/loyalty/lookup
 * Body: { slug, phone }
 * Cashier/owner/manager only — restaurant-scoped.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const phoneRaw = typeof body.phone === "string" ? body.phone : "";

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const ctx = await getLoyaltyStaffContext(slug);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const phone = normalizeLoyaltyPhone(phoneRaw);
  if (!phone) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("loyalty_settings")
    .select("enabled, target_order_count, reward_description")
    .eq("restaurant_id", ctx.restaurant.id)
    .maybeSingle();

  if (!settings?.enabled) {
    return NextResponse.json({
      enabled: false,
      phone_normalized: phone,
      current_count: 0,
      available_rewards: 0,
      target_order_count: 5,
      reward_description: null,
      orders_away: null,
    });
  }

  const target = Math.max(2, Number(settings.target_order_count) || 5);
  const { data: progress } = await admin
    .from("loyalty_progress")
    .select("current_count, available_rewards, updated_at")
    .eq("restaurant_id", ctx.restaurant.id)
    .eq("phone_normalized", phone)
    .maybeSingle();

  const current = Number(progress?.current_count ?? 0) || 0;
  const available = Number(progress?.available_rewards ?? 0) || 0;

  return NextResponse.json({
    enabled: true,
    phone_normalized: phone,
    current_count: current,
    available_rewards: available,
    target_order_count: target,
    reward_description: settings.reward_description,
    orders_away: Math.max(0, target - current),
    updated_at: progress?.updated_at ?? null,
  });
}
