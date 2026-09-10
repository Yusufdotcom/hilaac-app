/**
 * Canonical subscription capability map:
 * Goronyo / Gorgor / Galeyr / Somali Airlines (+ legacy).
 *
 * Legacy mapping (migration period):
 * - starter → Goronyo capabilities
 * - pro     → Somali Airlines capabilities (V3: never strip a paid Pro feature)
 * - trial   → Galeyr capabilities (trial = BI access, not SA exclusives)
 *
 * Fail-safe: unknown tier → most permissive (Somali Airlines) + loud console error.
 */

export const TIER_VALUES = [
  "trial",
  "starter",
  "pro",
  "goronyo",
  "gorgor",
  "galeyr",
  "somali_airlines",
] as const;

export type KnownTier = (typeof TIER_VALUES)[number];

/** Product capability keys used by `canUseFeature`. */
export type TierFeature =
  | "basic_reports"
  | "advanced_reports"
  | "ai_menu_images"
  | "api_payments"
  | "whatsapp_reengagement"
  | "recap_email"
  | "multi_branch"
  | "custom_branding"
  | "unlimited_staff"
  | "alerts_center"
  | "inventory"
  | "menu_profitability"
  | "multi_branch_comparison"
  | "ai_chatbot"
  | "expenses_pnl"
  | "staff_performance"
  | "customer_intelligence"
  | "cross_branch_benchmarking"
  | "ramadan_packages"
  | "eid_packages"
  | "package_gifting"
  | "event_hall_management"
  | "group_bookings"
  | "online_booking_link"
  | "ramadan_yoy_comparison"
  | "event_pl_report"
  | "campaign_codes_basic"
  | "campaign_analytics"
  | "deyn_ledger";

export type TierCapabilitySet = Readonly<Record<TierFeature, boolean>>;

const GORONYO: TierCapabilitySet = {
  basic_reports: true,
  advanced_reports: false,
  ai_menu_images: false,
  api_payments: false,
  whatsapp_reengagement: false,
  recap_email: false,
  multi_branch: false,
  custom_branding: false,
  unlimited_staff: false,
  alerts_center: false,
  inventory: false,
  menu_profitability: false,
  multi_branch_comparison: false,
  ai_chatbot: false,
  expenses_pnl: false,
  staff_performance: false,
  customer_intelligence: false,
  cross_branch_benchmarking: false,
  ramadan_packages: false,
  eid_packages: false,
  package_gifting: false,
  event_hall_management: false,
  group_bookings: false,
  online_booking_link: false,
  ramadan_yoy_comparison: false,
  event_pl_report: false,
  campaign_codes_basic: true,
  campaign_analytics: false,
  deyn_ledger: true,
};

const GORGOR: TierCapabilitySet = {
  ...GORONYO,
  advanced_reports: true,
  ai_menu_images: true,
  api_payments: true,
  whatsapp_reengagement: true,
  recap_email: true,
  multi_branch: true,
  custom_branding: true,
  unlimited_staff: true,
  alerts_center: true,
  inventory: true,
  menu_profitability: true,
  multi_branch_comparison: true,
  campaign_analytics: true,
};

const GALEYR: TierCapabilitySet = {
  ...GORGOR,
  ai_chatbot: true,
  expenses_pnl: true,
  staff_performance: true,
  customer_intelligence: true,
  cross_branch_benchmarking: true,
};

const SOMALI_AIRLINES: TierCapabilitySet = {
  ...GALEYR,
  ramadan_packages: true,
  eid_packages: true,
  package_gifting: true,
  event_hall_management: true,
  group_bookings: true,
  online_booking_link: true,
  ramadan_yoy_comparison: true,
  event_pl_report: true,
};

const GORONYO_FEATURES = [
  "QR code ordering",
  "Kitchen / Waiter / Cashier dashboards",
  "Manual USSD payments",
  "Loyalty + WhatsApp order notifications",
  "Up to 3 staff accounts",
  "Basic reports (Daily + Monthly)",
] as const;

const GORGOR_FEATURES = [
  "Everything in Goronyo 1.0",
  "API auto-payment",
  "AI menu image generator",
  "Unlimited staff accounts",
  "Advanced reports + Insights + export",
  "Recap email delivery",
  "Multi-branch + inventory (when enabled)",
] as const;

const GALEYR_FEATURES = [
  "Everything in Gorgor 1.0",
  "AI Business Chatbot (exclusive)",
  "Expenses / P&L",
  "Staff performance + scheduling",
  "Customer intelligence",
  "Cross-branch benchmarking",
] as const;

const SOMALI_AIRLINES_FEATURES = [
  "Everything in Galeyr 1.0",
  "Ramadan + Eid packages (Normal + Buffet)",
  "Wedding & event hall management",
  "Online booking link for social media",
  "Group & corporate bookings with quotes",
  "Package gifting via WhatsApp",
  "Year-over-year Ramadan comparison",
  "Post-event profit reports",
] as const;

/** Display / billing metadata for the 4-tier model (+ legacy aliases). */
export const TIER_PLANS = {
  goronyo: {
    name: "Goronyo 1.0",
    price: 15,
    priceLabel: "$15/mo",
    description: "QR ordering, staff dashboards, USSD payments, loyalty, and basic reports.",
    features: GORONYO_FEATURES,
  },
  gorgor: {
    name: "Gorgor 1.0",
    price: 30,
    priceLabel: "$30/mo",
    description: "Everything in Goronyo, plus API payments, AI tools, and growth features.",
    features: GORGOR_FEATURES,
  },
  galeyr: {
    name: "Galeyr 1.0",
    price: 60,
    priceLabel: "$60/mo",
    description: "Full business intelligence — chatbot, P&L, staff, and customer insights.",
    features: GALEYR_FEATURES,
  },
  somali_airlines: {
    name: "Somali Airlines 1.0",
    price: 120,
    priceLabel: "$120/mo",
    description: "For restaurants that do it all — events, halls, Ramadan packages.",
    features: SOMALI_AIRLINES_FEATURES,
  },
  /** Legacy aliases — kept during migration so old UI/email copy still resolves. */
  starter: {
    name: "Starter",
    price: 29,
    priceLabel: "$29/mo",
    description: "Legacy plan — maps to Goronyo capabilities.",
    features: GORONYO_FEATURES,
  },
  pro: {
    name: "Pro",
    price: 79,
    priceLabel: "$79/mo",
    description: "Legacy plan — maps to Somali Airlines capabilities (V3).",
    features: SOMALI_AIRLINES_FEATURES,
  },
  trial: {
    name: "Trial",
    price: 0,
    priceLabel: "Free trial",
    description: "Trial access — maps to Galeyr capabilities.",
    features: GALEYR_FEATURES,
  },
} as const;

const CAPABILITIES_BY_TIER: Record<KnownTier, TierCapabilitySet> = {
  goronyo: GORONYO,
  gorgor: GORGOR,
  galeyr: GALEYR,
  somali_airlines: SOMALI_AIRLINES,
  starter: GORONYO,
  pro: SOMALI_AIRLINES,
  trial: GALEYR,
};

const unknownTierLogged = new Set<string>();

export function normalizeTier(tier: string | null | undefined): KnownTier | null {
  if (!tier) return null;
  const t = tier.trim().toLowerCase();
  return (TIER_VALUES as readonly string[]).includes(t) ? (t as KnownTier) : null;
}

/** Resolve capability set. Unknown tiers fail open to Somali Airlines. */
export function capabilitiesForTier(tier: string | null | undefined): TierCapabilitySet {
  const known = normalizeTier(tier);
  if (known) return CAPABILITIES_BY_TIER[known];

  const key = tier ?? "(null)";
  if (!unknownTierLogged.has(key)) {
    unknownTierLogged.add(key);
    console.error(
      `[billing] Unknown subscription_tier "${key}" — failing OPEN to Somali Airlines capabilities. Fix mapping immediately.`
    );
  }
  return SOMALI_AIRLINES;
}

export function canUseFeature(
  tier: string | null | undefined,
  feature: TierFeature
): boolean {
  return capabilitiesForTier(tier)[feature] === true;
}

export function tierDisplayName(tier: string | null | undefined): string {
  const known = normalizeTier(tier);
  if (!known) return tier ? `${tier} Plan` : "Unknown Plan";
  if (known === "goronyo") return TIER_PLANS.goronyo.name;
  if (known === "gorgor") return TIER_PLANS.gorgor.name;
  if (known === "galeyr") return TIER_PLANS.galeyr.name;
  if (known === "somali_airlines") return TIER_PLANS.somali_airlines.name;
  if (known === "starter") return "Starter Plan";
  if (known === "pro") return "Pro Plan";
  return "Trial Plan";
}

/** Billable paid tiers for renew / switch flows (new model). */
export type NewBillableTier = "goronyo" | "gorgor" | "galeyr" | "somali_airlines";

export function isNewBillableTier(tier: string | null | undefined): tier is NewBillableTier {
  return (
    tier === "goronyo" ||
    tier === "gorgor" ||
    tier === "galeyr" ||
    tier === "somali_airlines"
  );
}
