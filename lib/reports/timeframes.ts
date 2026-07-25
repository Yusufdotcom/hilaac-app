import type { ReportGranularity } from "@/lib/reports/types";
import type { SubscriptionTier } from "@/types/database";
import {
  APP_TIMEZONE,
  formatAppDateRangeLabel,
  getAppDayBounds,
  getAppMonthBounds,
  getAppYearBounds,
} from "@/lib/time/app-calendar";

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
      return getAppMonthBounds(periodOffset);
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

/**
 * Bucket size for the revenue chart within the selected window.
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
