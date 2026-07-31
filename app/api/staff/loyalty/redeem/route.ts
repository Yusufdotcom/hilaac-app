import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLoyaltyStaffContext } from "@/lib/loyalty/staff-auth";

/**
 * POST /api/staff/loyalty/redeem
 * Body: { slug, phone }
 * Manual staff-confirmed redemption — never callable anonymously.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone : "";

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const ctx = await getLoyaltyStaffContext(slug);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createClient();
  const { data, error } = await supabase.rpc("redeem_loyalty_reward", {
    p_restaurant_id: ctx.restaurant.id,
    p_phone: phone,
    p_staff_id: ctx.userId,
  });

  if (error) {
    console.error("[loyalty] redeem failed", {
      restaurantId: ctx.restaurant.id,
      staffId: ctx.userId,
      error: error.message,
    });
    const message = error.message.includes("No available reward")
      ? "No available reward for this phone number."
      : error.message.includes("not enabled")
        ? "Loyalty program is not enabled."
        : error.message.includes("Invalid phone")
          ? "Enter a valid phone number."
          : "Could not redeem reward.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    phone_normalized: row?.phone_normalized,
    current_count: Number(row?.current_count ?? 0),
    available_rewards: Number(row?.available_rewards ?? 0),
    reward_description: row?.reward_description ?? null,
  });
}
