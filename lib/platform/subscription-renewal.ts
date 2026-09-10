import { PLANS } from "@/lib/constants";
import type { NewBillableTier } from "@/lib/billing/tier-capabilities";
import type { SubscriptionTier } from "@/types/database";

/** Paid tiers that can be written on renew/confirm (legacy + new). */
export type BillableTier = "starter" | "pro" | NewBillableTier;

export type RenewalIntent =
  | "renew"
  | "upgrade_pro"
  | "switch_starter"
  | "switch_goronyo"
  | "switch_gorgor"
  | "switch_galeyr"
  | "switch_somali_airlines";

const DAY_MS = 30 * 24 * 60 * 60 * 1000;

const BILLABLE: readonly BillableTier[] = [
  "starter",
  "pro",
  "goronyo",
  "gorgor",
  "galeyr",
  "somali_airlines",
];

export function isBillableTier(tier: string | null | undefined): tier is BillableTier {
  return !!tier && (BILLABLE as readonly string[]).includes(tier);
}

export function parseRenewalIntent(raw: unknown): RenewalIntent {
  if (raw === "upgrade_pro") return "upgrade_pro";
  if (raw === "switch_starter") return "switch_starter";
  if (raw === "switch_goronyo") return "switch_goronyo";
  if (raw === "switch_gorgor") return "switch_gorgor";
  if (raw === "switch_galeyr") return "switch_galeyr";
  if (raw === "switch_somali_airlines") return "switch_somali_airlines";
  return "renew";
}

export function isPlanSwitchIntent(intent: RenewalIntent): boolean {
  return intent !== "renew";
}

/**
 * Which billing card highlights as "current" for a restaurant tier.
 * Legacy starter → Goronyo; legacy pro → Somali Airlines; trial → Galeyr.
 */
export function billingCardForTier(
  tier: SubscriptionTier | string | null | undefined
): NewBillableTier {
  if (tier === "somali_airlines" || tier === "pro") return "somali_airlines";
  if (tier === "gorgor") return "gorgor";
  if (tier === "goronyo" || tier === "starter") return "goronyo";
  return "galeyr";
}

export function intentForBillingCard(
  currentTier: SubscriptionTier | string | null | undefined,
  targetCard: NewBillableTier
): RenewalIntent {
  const currentCard = billingCardForTier(currentTier);
  if (targetCard === currentCard) return "renew";
  if (targetCard === "goronyo") return "switch_goronyo";
  if (targetCard === "gorgor") return "switch_gorgor";
  if (targetCard === "galeyr") return "switch_galeyr";
  return "switch_somali_airlines";
}

export function resolveRenewalTier(
  currentTier: SubscriptionTier | string | null | undefined,
  intent: RenewalIntent
): BillableTier {
  if (intent === "switch_goronyo") return "goronyo";
  if (intent === "switch_gorgor") return "gorgor";
  if (intent === "switch_galeyr") return "galeyr";
  if (intent === "switch_somali_airlines") return "somali_airlines";
  if (intent === "upgrade_pro") return "pro";
  if (intent === "switch_starter") return "starter";

  // renew — keep exact current paid tier; trial → goronyo
  if (isBillableTier(currentTier)) return currentTier;
  if (currentTier === "trial") return "goronyo";
  return "goronyo";
}

export function renewalAmountForTier(tier: BillableTier): number {
  return PLANS[tier].price;
}

/** Same-plan renew: extend from max(now, current_end) by 30 days. */
export function nextSubscriptionEndDate(currentEnd: string | Date | null | undefined): string {
  const now = Date.now();
  const currentMs = currentEnd ? new Date(currentEnd).getTime() : NaN;
  const base = Number.isFinite(currentMs) ? Math.max(now, currentMs) : now;
  return new Date(base + DAY_MS).toISOString();
}

/** Plan switch: fresh 30 days from confirmation (now). */
export function freshSubscriptionEndDate(from: Date = new Date()): string {
  return new Date(from.getTime() + DAY_MS).toISOString();
}

/**
 * Same tier renew → extend remaining period.
 * Tier change (upgrade/downgrade/trial→paid) → now + 30d.
 */
export function nextEndDateForConfirm(opts: {
  currentTier: string | null | undefined;
  renewalTier: BillableTier;
  currentEnd: string | Date | null | undefined;
}): string {
  if (opts.currentTier === opts.renewalTier) {
    return nextSubscriptionEndDate(opts.currentEnd);
  }
  return freshSubscriptionEndDate();
}

/** Force USSD when moving onto a tier that does not include API payments. */
export function shouldForceUssdOnTier(tier: BillableTier): boolean {
  return tier === "starter" || tier === "goronyo";
}
