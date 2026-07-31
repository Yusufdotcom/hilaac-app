"use client";

import { Gift, Sparkles } from "lucide-react";
import { brandColorWithAlpha } from "@/lib/brand/restaurant-brand";
import type { LoyaltyCustomerStatus } from "@/lib/loyalty/types";
import { cn } from "@/lib/utils";

export function LoyaltyStatusCard({
  loyalty,
  accent,
}: {
  loyalty: LoyaltyCustomerStatus;
  accent: string;
}) {
  if (!loyalty.enabled) return null;

  const hasReward = loyalty.available_rewards > 0;
  const filled = Math.min(loyalty.target_order_count, loyalty.current_count);
  const rewardLabel = loyalty.reward_description.trim();
  const rewardPhrase = /^free\b/i.test(rewardLabel) ? rewardLabel : `a free ${rewardLabel}`;

  return (
    <div
      className={cn(
        "mt-2 shrink-0 rounded-2xl border px-3.5 py-3 text-left shadow-sm",
        hasReward ? "border-emerald-200 bg-emerald-50/90" : "border-slate-200 bg-white"
      )}
      style={
        !hasReward
          ? {
              borderColor: brandColorWithAlpha(accent, 0.28),
              backgroundColor: brandColorWithAlpha(accent, 0.06),
            }
          : undefined
      }
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            hasReward ? "bg-emerald-100 text-emerald-700" : "bg-white shadow-sm"
          )}
          style={!hasReward ? { color: accent } : undefined}
        >
          {hasReward ? (
            <Gift className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {hasReward ? (
            <>
              <p className="text-xs font-bold text-emerald-900">
                You have {loyalty.available_rewards > 1 ? `${loyalty.available_rewards}× ` : ""}
                {rewardPhrase} waiting
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-emerald-800">
                Mention this to your cashier to redeem!
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-slate-900">
                {loyalty.orders_away === 1
                  ? `You're 1 order away from ${rewardPhrase}!`
                  : `You're ${loyalty.orders_away} orders away from ${rewardPhrase}!`}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Loyalty · {filled}/{loyalty.target_order_count} orders
              </p>
            </>
          )}

          <div className="mt-2 flex gap-1">
            {Array.from({ length: loyalty.target_order_count }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i < filled ? "opacity-100" : "bg-slate-200/90 opacity-70"
                )}
                style={i < filled ? { backgroundColor: hasReward ? "#059669" : accent } : undefined}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
