import {
  TIER_PLANS,
  canUseFeature,
  tierDisplayName,
} from "@/lib/billing/tier-capabilities";

/**
 * Billing / marketing plan cards.
 * During migration: keep starter/pro for existing renew flows;
 * expose Goronyo/Gorgor/Galeyr/Somali Airlines for the current UI.
 */
export const PLANS = {
  starter: {
    name: TIER_PLANS.starter.name,
    price: TIER_PLANS.starter.price,
    priceLabel: TIER_PLANS.starter.priceLabel,
    description: TIER_PLANS.starter.description,
    features: [...TIER_PLANS.starter.features],
  },
  pro: {
    name: TIER_PLANS.pro.name,
    price: TIER_PLANS.pro.price,
    priceLabel: TIER_PLANS.pro.priceLabel,
    description: TIER_PLANS.pro.description,
    features: [...TIER_PLANS.pro.features],
  },
  goronyo: {
    name: TIER_PLANS.goronyo.name,
    price: TIER_PLANS.goronyo.price,
    priceLabel: TIER_PLANS.goronyo.priceLabel,
    description: TIER_PLANS.goronyo.description,
    features: [...TIER_PLANS.goronyo.features],
  },
  gorgor: {
    name: TIER_PLANS.gorgor.name,
    price: TIER_PLANS.gorgor.price,
    priceLabel: TIER_PLANS.gorgor.priceLabel,
    description: TIER_PLANS.gorgor.description,
    features: [...TIER_PLANS.gorgor.features],
  },
  galeyr: {
    name: TIER_PLANS.galeyr.name,
    price: TIER_PLANS.galeyr.price,
    priceLabel: TIER_PLANS.galeyr.priceLabel,
    description: TIER_PLANS.galeyr.description,
    features: [...TIER_PLANS.galeyr.features],
  },
  somali_airlines: {
    name: TIER_PLANS.somali_airlines.name,
    price: TIER_PLANS.somali_airlines.price,
    priceLabel: TIER_PLANS.somali_airlines.priceLabel,
    description: TIER_PLANS.somali_airlines.description,
    features: [...TIER_PLANS.somali_airlines.features],
  },
} as const;

/** Landing + marketing grid order. */
export const LANDING_PLAN_KEYS = [
  "goronyo",
  "gorgor",
  "galeyr",
  "somali_airlines",
] as const;

export type LandingPlanKey = (typeof LANDING_PLAN_KEYS)[number];

export const TRIAL_DAYS = 7;

/** @deprecated Prefer canUseFeature(tier, "ai_menu_images") */
export function canUseAiFeatures(tier: string | null | undefined) {
  return canUseFeature(tier, "ai_menu_images");
}

/** @deprecated Prefer canUseFeature(tier, "api_payments") */
export function canUseApiPayments(tier: string | null | undefined) {
  return canUseFeature(tier, "api_payments");
}

/** @deprecated Prefer canUseFeature(tier, "whatsapp_reengagement") */
export function canUseWhatsAppReengagement(tier: string | null | undefined) {
  return canUseFeature(tier, "whatsapp_reengagement");
}

/** @deprecated Prefer canUseFeature(tier, "recap_email") */
export function canReceiveRecapEmail(tier: string | null | undefined) {
  return canUseFeature(tier, "recap_email");
}

export { canUseFeature, tierDisplayName };

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  waiter: "Waiter",
  kitchen: "Kitchen Staff",
  cashier: "Cashier",
};
