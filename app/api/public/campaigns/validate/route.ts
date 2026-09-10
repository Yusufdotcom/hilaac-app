import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  normalizePromoCode,
  validateCampaignAgainstOrder,
  type CampaignRow,
} from "@/lib/campaigns/promo";
import { getAppDayBounds } from "@/lib/time/app-calendar";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/campaigns/validate
 * Live promo-code check for QR checkout (no auth).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const restaurantId = String(body.restaurant_id ?? "").trim();
  const code = normalizePromoCode(String(body.code ?? ""));
  const orderTotal = Number(body.order_total ?? 0) || 0;

  if (!restaurantId || !code) {
    return NextResponse.json({ ok: false, error: "Code is required", code: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("code", code)
    .maybeSingle();

  if (!campaign) {
    return NextResponse.json({ ok: false, error: "Invalid promo code", code: "not_found" });
  }

  const { ymd } = getAppDayBounds(0);
  const today = `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;
  const result = validateCampaignAgainstOrder(campaign as CampaignRow, orderTotal, today);

  if (!result.ok) {
    return NextResponse.json(result);
  }

  return NextResponse.json({
    ok: true,
    code: result.campaign.code,
    name: result.campaign.name,
    discount: result.discount,
    total_before: result.totalBefore,
    total_after: result.totalAfter,
    discount_type: result.campaign.discount_type,
    discount_value: result.campaign.discount_value,
  });
}
