/**
 * Campaign / promo-code helpers (validate + apply discount).
 */

export type CampaignDiscountType = "percentage" | "fixed";

export type CampaignRow = {
  id: string;
  restaurant_id: string;
  name: string;
  code: string;
  discount_type: CampaignDiscountType;
  discount_value: number;
  valid_from: string;
  valid_to: string;
  max_uses: number | null;
  uses_count: number;
  min_order_amount: number | null;
  is_active: boolean;
};

export type PromoValidateOk = {
  ok: true;
  campaign: CampaignRow;
  discount: number;
  totalBefore: number;
  totalAfter: number;
};

export type PromoValidateErr = {
  ok: false;
  error: string;
  code:
    | "not_found"
    | "inactive"
    | "expired"
    | "not_started"
    | "max_uses"
    | "min_order"
    | "invalid";
};

export function normalizePromoCode(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function computeCampaignDiscount(
  campaign: Pick<CampaignRow, "discount_type" | "discount_value">,
  orderTotal: number
): number {
  const total = Math.max(0, Number(orderTotal) || 0);
  if (total <= 0) return 0;
  if (campaign.discount_type === "percentage") {
    const pct = Math.min(100, Math.max(0, Number(campaign.discount_value) || 0));
    return Math.round(((total * pct) / 100) * 100) / 100;
  }
  return Math.min(total, Math.max(0, Number(campaign.discount_value) || 0));
}

/** Calendar-day check using YYYY-MM-DD strings (APP timezone dates from client/server). */
export function validateCampaignAgainstOrder(
  campaign: CampaignRow,
  orderTotal: number,
  todayYmd: string
): PromoValidateOk | PromoValidateErr {
  if (!campaign.is_active) {
    return { ok: false, error: "This promo code is inactive", code: "inactive" };
  }
  if (todayYmd < campaign.valid_from) {
    return { ok: false, error: "This promo code is not valid yet", code: "not_started" };
  }
  if (todayYmd > campaign.valid_to) {
    return { ok: false, error: "This promo code has expired", code: "expired" };
  }
  if (campaign.max_uses != null && campaign.uses_count >= campaign.max_uses) {
    return { ok: false, error: "This promo code has reached its usage limit", code: "max_uses" };
  }
  const min = campaign.min_order_amount != null ? Number(campaign.min_order_amount) : null;
  if (min != null && orderTotal < min) {
    return {
      ok: false,
      error: `Minimum order is $${min.toFixed(2)} for this code`,
      code: "min_order",
    };
  }

  const discount = computeCampaignDiscount(campaign, orderTotal);
  if (discount <= 0) {
    return { ok: false, error: "Promo does not apply to this order", code: "invalid" };
  }

  return {
    ok: true,
    campaign,
    discount,
    totalBefore: orderTotal,
    totalAfter: Math.max(0, Math.round((orderTotal - discount) * 100) / 100),
  };
}

export const SOMALI_CAMPAIGN_PRESETS = [
  { key: "ramadan", label: "Ramadan Special", name: "Ramadan Special" },
  { key: "eid", label: "Eid Offer", name: "Eid Offer" },
  { key: "school", label: "Back to School", name: "Back to School" },
  { key: "form4", label: "Form 4 Results Day", name: "Form 4 Results Day" },
  { key: "friday", label: "Friday Special", name: "Friday Special" },
] as const;
