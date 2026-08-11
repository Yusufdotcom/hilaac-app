import { PLANS } from "@/lib/constants";
import type { SubscriptionTier } from "@/types/database";

export type BillableTier = "starter" | "pro";

export type RenewalIntent = "renew" | "upgrade_pro" | "switch_starter";

const DAY_MS = 30 * 24 * 60 * 60 * 1000;

export function parseRenewalIntent(raw: unknown): RenewalIntent {
  if (raw === "upgrade_pro") return "upgrade_pro";
  if (raw === "switch_starter") return "switch_starter";
  return "renew";
}

export function isPlanSwitchIntent(intent: RenewalIntent): boolean {
  return intent === "upgrade_pro" || intent === "switch_starter";
}

export function resolveRenewalTier(
  currentTier: SubscriptionTier | string | null | undefined,
  intent: RenewalIntent
): BillableTier {
  if (intent === "upgrade_pro") return "pro";
  if (intent === "switch_starter") return "starter";
  if (currentTier === "pro") return "pro";
  return "starter";
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
