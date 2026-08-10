import { PLANS } from "@/lib/constants";
import type { SubscriptionTier } from "@/types/database";

export type BillableTier = "starter" | "pro";

export function resolveRenewalTier(
  currentTier: SubscriptionTier | string | null | undefined,
  intent: "renew" | "upgrade_pro"
): BillableTier {
  if (intent === "upgrade_pro") return "pro";
  if (currentTier === "pro") return "pro";
  return "starter";
}

export function renewalAmountForTier(tier: BillableTier): number {
  return PLANS[tier].price;
}

/** Extend from max(now, current_end) by 30 days. */
export function nextSubscriptionEndDate(currentEnd: string | Date | null | undefined): string {
  const now = Date.now();
  const currentMs = currentEnd ? new Date(currentEnd).getTime() : NaN;
  const base = Number.isFinite(currentMs) ? Math.max(now, currentMs) : now;
  return new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();
}
