import type { ReportGranularity } from "@/lib/reports/types";
import type { SubscriptionTier } from "@/types/database";

export function hasProReports(tier: SubscriptionTier, subscriptionStatus: string): boolean {
  if (subscriptionStatus === "expired") return false;
  return tier === "pro" || tier === "trial";
}

/** Starter: Daily + Monthly. Pro: Daily, Weekly, Monthly, Yearly. */
export function getAvailableGranularities(
  _tier: SubscriptionTier,
  isPro: boolean
): ReportGranularity[] {
  if (isPro) return ["daily", "weekly", "monthly", "yearly"];
  return ["daily", "monthly"];
}

export function getAllGranularities(): ReportGranularity[] {
  return ["daily", "weekly", "monthly", "yearly"];
}

function shiftRange(
  start: Date,
  end: Date,
  granularity: ReportGranularity,
  periodOffset: number
): { start: Date; end: Date } {
  if (periodOffset === 0) return { start, end };

  const s = new Date(start);
  const e = new Date(end);

  switch (granularity) {
    case "weekly": {
      s.setDate(s.getDate() + periodOffset * 7 * 12);
      e.setDate(e.getDate() + periodOffset * 7 * 12);
      break;
    }
    case "monthly": {
      s.setMonth(s.getMonth() + periodOffset * 12);
      e.setMonth(e.getMonth() + periodOffset * 12);
      break;
    }
    case "yearly": {
      s.setFullYear(s.getFullYear() + periodOffset * 5);
      e.setFullYear(e.getFullYear() + periodOffset * 5);
      break;
    }
    default: {
      // daily window ≈ 30 days
      s.setDate(s.getDate() + periodOffset * 30);
      e.setDate(e.getDate() + periodOffset * 30);
      break;
    }
  }

  return { start: s, end: e };
}

export function getDateRange(
  granularity: ReportGranularity,
  periodOffset = 0
): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  switch (granularity) {
    case "weekly":
      start.setDate(start.getDate() - 7 * 11);
      break;
    case "monthly":
      start.setMonth(start.getMonth() - 11);
      start.setDate(1);
      break;
    case "yearly":
      start.setFullYear(start.getFullYear() - 4);
      start.setMonth(0, 1);
      break;
    default:
      start.setDate(start.getDate() - 29);
      break;
  }
  start.setHours(0, 0, 0, 0);

  return shiftRange(start, end, granularity, periodOffset);
}

/** Previous window of equal length, ending just before the current range starts. */
export function getPreviousDateRange(
  granularity: ReportGranularity,
  periodOffset = 0
): { start: Date; end: Date } {
  const { start, end } = getDateRange(granularity, periodOffset);
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  prevStart.setHours(0, 0, 0, 0);
  return { start: prevStart, end: prevEnd };
}

export function formatDateRangeLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

export function granularityLabel(granularity: ReportGranularity) {
  switch (granularity) {
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    default:
      return "Daily";
  }
}
