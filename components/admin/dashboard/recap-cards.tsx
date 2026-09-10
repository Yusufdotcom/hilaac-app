"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Moon, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { DailyRecap, MonthlyRecap } from "@/lib/recap/fetch-recap";
import { canReceiveRecapEmail } from "@/lib/constants";
import {
  dismissRecap,
  isRecapDismissed,
  recapDismissStorageKey,
} from "@/lib/recap/recap-dismiss";

function deltaText(pct: number | null, previousRevenue = 0): { label: string; className: string } {
  if (previousRevenue <= 0 && (pct ?? 0) > 0) {
    return { label: "no paid sales last time", className: "text-[var(--admin-muted,#94A3B8)]" };
  }
  if (pct == null || Math.abs(pct) < 0.5) {
    return { label: "about even with last time", className: "text-[var(--admin-muted,#94A3B8)]" };
  }
  if (pct > 0) {
    return { label: `↑ ${Math.abs(Math.round(pct))}% vs last time`, className: "text-emerald-600" };
  }
  return { label: `↓ ${Math.abs(Math.round(pct))}% vs last time`, className: "text-red-600" };
}

export function RecapCards({
  restaurantId,
  dailyPeriodKey,
  weeklyPeriodKey,
  daily,
  monthly,
  tier,
  dailyError,
  monthlyError,
}: {
  restaurantId: string;
  /** APP day key — daily card returns after this day rolls. */
  dailyPeriodKey: string;
  /** APP week key — monthly card returns next week after dismiss. */
  weeklyPeriodKey: string;
  daily: DailyRecap | null;
  monthly: MonthlyRecap | null;
  tier: string;
  dailyError?: string | null;
  monthlyError?: string | null;
}) {
  const emailOnPro = canReceiveRecapEmail(tier);
  const dailyKey = recapDismissStorageKey(restaurantId, "daily", dailyPeriodKey);
  const weeklyKey = recapDismissStorageKey(restaurantId, "weekly", weeklyPeriodKey);

  const [ready, setReady] = useState(false);
  const [hideDaily, setHideDaily] = useState(false);
  const [hideWeekly, setHideWeekly] = useState(false);

  useEffect(() => {
    setHideDaily(isRecapDismissed(dailyKey));
    setHideWeekly(isRecapDismissed(weeklyKey));
    setReady(true);
  }, [dailyKey, weeklyKey]);

  function onDismissDaily() {
    dismissRecap(dailyKey);
    setHideDaily(true);
  }

  function onDismissWeekly() {
    dismissRecap(weeklyKey);
    setHideWeekly(true);
  }

  // Avoid flash of dismissed cards before localStorage read.
  if (!ready) return null;
  if (hideDaily && hideWeekly) return null;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {!hideDaily ? (
        <article className="admin-glass-hover relative rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5 sm:p-6">
          <button
            type="button"
            onClick={onDismissDaily}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--admin-muted,#64748B)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-text,#0F172A)]"
            aria-label="Dismiss daily recap until tomorrow"
            title="Dismiss until tomorrow"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="mb-3 flex items-start justify-between gap-3 pr-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted,#64748B)]">
                Daily recap
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--admin-text,#0F172A)]">
                {daily?.headline ?? "Yesterday in review"}
              </h2>
            </div>
            <span className="admin-brand-tint flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Moon className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          {dailyError ? (
            <p className="text-sm text-red-700">{dailyError}</p>
          ) : daily ? (
            <>
              <p className="text-sm leading-relaxed text-[var(--admin-text,#0F172A)]">{daily.body}</p>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-[var(--admin-muted,#64748B)]">Orders</dt>
                  <dd className="font-semibold text-[var(--admin-text,#0F172A)]">{daily.kpi.orders}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--admin-muted,#64748B)]">Revenue</dt>
                  <dd className="font-semibold text-[var(--admin-text,#0F172A)]">
                    {formatCurrency(daily.kpi.revenue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--admin-muted,#64748B)]">Top item</dt>
                  <dd className="truncate font-semibold text-[var(--admin-text,#0F172A)]">
                    {daily.kpi.topItemName ?? "—"}
                  </dd>
                </div>
              </dl>
              <p
                className={`mt-3 text-xs font-semibold ${deltaText(daily.comparison.revenueDeltaPct, daily.comparison.previousRevenue).className}`}
              >
                {deltaText(daily.comparison.revenueDeltaPct, daily.comparison.previousRevenue).label}
              </p>
              <p className="mt-2 text-xs text-[var(--admin-muted,#94A3B8)]">{daily.window.hoursLabel}</p>
            </>
          ) : (
            <p className="text-sm text-[var(--admin-muted,#64748B)]">Recap isn’t ready yet.</p>
          )}
          {!emailOnPro ? (
            <p className="mt-3 text-xs text-[var(--admin-muted,#94A3B8)]">
              Email recaps are included on Gorgor 1.0+. This card stays on every plan.
            </p>
          ) : null}
          <p className="mt-3 text-[11px] text-[var(--admin-muted,#94A3B8)]">
            Dismiss for today — returns tomorrow.
          </p>
        </article>
      ) : null}

      {!hideWeekly ? (
        <article className="admin-glass-hover relative rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5 sm:p-6">
          <button
            type="button"
            onClick={onDismissWeekly}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--admin-muted,#64748B)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-text,#0F172A)]"
            aria-label="Dismiss monthly recap until next week"
            title="Dismiss until next week"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="mb-3 flex items-start justify-between gap-3 pr-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted,#64748B)]">
                Monthly recap
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--admin-text,#0F172A)]">
                {monthly?.headline ?? "Last month"}
              </h2>
            </div>
            <span className="admin-brand-tint flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          {monthlyError ? (
            <p className="text-sm text-red-700">{monthlyError}</p>
          ) : monthly ? (
            <>
              <p className="text-sm leading-relaxed text-[var(--admin-text,#0F172A)]">{monthly.body}</p>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-[var(--admin-muted,#64748B)]">Orders</dt>
                  <dd className="font-semibold text-[var(--admin-text,#0F172A)]">{monthly.kpi.orders}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--admin-muted,#64748B)]">Revenue</dt>
                  <dd className="font-semibold text-[var(--admin-text,#0F172A)]">
                    {formatCurrency(monthly.kpi.revenue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--admin-muted,#64748B)]">Best day</dt>
                  <dd className="truncate font-semibold text-[var(--admin-text,#0F172A)]">
                    {monthly.bestDay?.label ?? "—"}
                  </dd>
                </div>
              </dl>
              {monthly.topItems.length > 0 ? (
                <p className="mt-3 text-xs text-[var(--admin-muted,#64748B)]">
                  Top items: {monthly.topItems.map((i) => i.name).join(", ")}
                </p>
              ) : null}
              <p
                className={`mt-2 text-xs font-semibold ${deltaText(monthly.comparison.revenueDeltaPct, monthly.comparison.previousRevenue).className}`}
              >
                {
                  deltaText(monthly.comparison.revenueDeltaPct, monthly.comparison.previousRevenue)
                    .label
                }
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--admin-muted,#64748B)]">Recap isn’t ready yet.</p>
          )}
          <p className="mt-3 text-[11px] text-[var(--admin-muted,#94A3B8)]">
            Dismiss for this week — returns next week.
          </p>
        </article>
      ) : null}
    </div>
  );
}
