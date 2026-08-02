import type { ReportGranularity } from "@/lib/reports/types";
import type { SubscriptionTier } from "@/types/database";
import {
  APP_TIMEZONE,
  formatAppDateRangeLabel,
  getAppDayBounds,
  getAppYearBounds,
} from "@/lib/time/app-calendar";

/** Fraction of a period that must elapse before a 0→N decline is treated as a real trend. */
export const TREND_MIN_ELAPSED_FRACTION = 0.2;

export function hasProReports(tier: SubscriptionTier, subscriptionStatus: string): boolean {
  if (subscriptionStatus === "expired") return false;
  return tier === "pro" || tier === "trial";
}

/**
 * Starter: Daily + Monthly.
 * Pro: Daily, Weekly, Biweekly, Monthly, Yearly.
 */
export function getAvailableGranularities(
  _tier: SubscriptionTier,
  isPro: boolean
): ReportGranularity[] {
  if (isPro) return ["daily", "weekly", "biweekly", "monthly", "yearly"];
  return ["daily", "monthly"];
}

export function getAllGranularities(): ReportGranularity[] {
  return ["daily", "weekly", "biweekly", "monthly", "yearly"];
}

/**
 * Half-open [start, end) in absolute UTC, using APP_TIMEZONE calendar days.
 * Same definition as Dashboard "today" RPCs.
 *
 * Daily / Weekly / Biweekly / Monthly are trailing windows ending on the
 * selected day. Yearly remains a fixed calendar year (accounting view).
 */
export function getDateRange(
  granularity: ReportGranularity,
  periodOffset = 0
): { start: Date; end: Date } {
  switch (granularity) {
    case "daily": {
      const { start, end } = getAppDayBounds(periodOffset);
      return { start, end };
    }
    case "weekly": {
      // 7 calendar days ending on selected day (inclusive).
      const { end } = getAppDayBounds(periodOffset * 7);
      const { start } = getAppDayBounds(periodOffset * 7 - 6);
      return { start, end };
    }
    case "biweekly": {
      const { end } = getAppDayBounds(periodOffset * 14);
      const { start } = getAppDayBounds(periodOffset * 14 - 13);
      return { start, end };
    }
    case "monthly": {
      // 30 calendar days ending on selected day (inclusive) — not a fixed calendar month.
      const { end } = getAppDayBounds(periodOffset * 30);
      const { start } = getAppDayBounds(periodOffset * 30 - 29);
      return { start, end };
    }
    case "yearly": {
      return getAppYearBounds(periodOffset);
    }
    default: {
      return getAppDayBounds(0);
    }
  }
}

/** Previous window of the same shape (one step earlier). */
export function getPreviousDateRange(
  granularity: ReportGranularity,
  periodOffset = 0
): { start: Date; end: Date } {
  return getDateRange(granularity, periodOffset - 1);
}

/** How much of [start, end) has elapsed as of `now` (0–1). */
export function getPeriodElapsedFraction(
  start: Date,
  end: Date,
  now: Date = new Date()
): number {
  const durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0) return 1;
  const elapsedMs = Math.min(durationMs, Math.max(0, now.getTime() - start.getTime()));
  return elapsedMs / durationMs;
}

/**
 * Suppress alarming decline badges when the current window has barely started
 * and has no orders yet (e.g. just after midnight on Daily, or early January on Yearly).
 */
export function shouldSuppressTrendForSparsePeriod(
  start: Date,
  end: Date,
  currentOrders: number,
  now: Date = new Date()
): boolean {
  if (currentOrders > 0) return false;
  return getPeriodElapsedFraction(start, end, now) < TREND_MIN_ELAPSED_FRACTION;
}

export {
  getChartBucketGranularity,
  fillRevenueBuckets,
  type ChartBucketGranularity,
} from "@/lib/reports/chart-buckets";

export function formatDateRangeLabel(start: string, end: string) {
  return formatAppDateRangeLabel(start, end);
}

export function granularityLabel(granularity: ReportGranularity) {
  switch (granularity) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Biweekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    default:
      return "Daily";
  }
}

export { APP_TIMEZONE };
