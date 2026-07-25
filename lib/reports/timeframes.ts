import type { ReportGranularity } from "@/lib/reports/types";
import type { SubscriptionTier } from "@/types/database";

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

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Inclusive calendar-day helper: returns [start, end) where end is midnight
 * after the last inclusive day — matches Dashboard SQL
 * (`created_at >= current_date AND created_at < current_date + 1 day`).
 */
export function getDateRange(
  granularity: ReportGranularity,
  periodOffset = 0
): { start: Date; end: Date } {
  const now = new Date();

  switch (granularity) {
    case "daily": {
      // Single calendar day. periodOffset steps ±1 day (0 = today).
      const start = startOfLocalDay(now);
      start.setDate(start.getDate() + periodOffset);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case "weekly": {
      // 7-day window ending on the selected day (inclusive).
      const endDay = startOfLocalDay(now);
      endDay.setDate(endDay.getDate() + periodOffset * 7);
      const start = new Date(endDay);
      start.setDate(start.getDate() - 6);
      const end = new Date(endDay);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case "biweekly": {
      // 14-day window ending on the selected day (inclusive).
      const endDay = startOfLocalDay(now);
      endDay.setDate(endDay.getDate() + periodOffset * 14);
      const start = new Date(endDay);
      start.setDate(start.getDate() - 13);
      const end = new Date(endDay);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case "monthly": {
      // Full calendar month. periodOffset steps ±1 month.
      const start = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { start, end };
    }
    case "yearly": {
      // Full calendar year. periodOffset steps ±1 year.
      const year = now.getFullYear() + periodOffset;
      const start = new Date(year, 0, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(year + 1, 0, 1);
      return { start, end };
    }
    default: {
      const start = startOfLocalDay(now);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
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

/**
 * Bucket size for the revenue chart within the selected window.
 * Wider windows use finer buckets so trends remain readable.
 */
export function getChartBucketGranularity(
  granularity: ReportGranularity
): "daily" | "weekly" | "monthly" | "yearly" {
  switch (granularity) {
    case "yearly":
      return "monthly";
    case "monthly":
    case "weekly":
    case "biweekly":
    case "daily":
    default:
      return "daily";
  }
}

export function formatDateRangeLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  // `end` is exclusive (start of the next period).
  const lastInclusive = new Date(e.getTime() - 1);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

  const sameCalendarDay =
    s.getFullYear() === lastInclusive.getFullYear() &&
    s.getMonth() === lastInclusive.getMonth() &&
    s.getDate() === lastInclusive.getDate();

  if (sameCalendarDay) {
    return s.toLocaleDateString(undefined, opts);
  }

  return `${s.toLocaleDateString(undefined, opts)} – ${lastInclusive.toLocaleDateString(undefined, opts)}`;
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
