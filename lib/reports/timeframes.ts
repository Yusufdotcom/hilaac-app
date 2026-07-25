import type { ReportGranularity } from "@/lib/reports/types";
import type { SubscriptionTier } from "@/types/database";

export function hasProReports(tier: SubscriptionTier, subscriptionStatus: string): boolean {
  if (subscriptionStatus === "expired") return false;
  return tier === "pro" || tier === "trial";
}

export function getAvailableGranularities(tier: SubscriptionTier, isPro: boolean): ReportGranularity[] {
  if (isPro) return ["daily", "weekly", "biweekly", "monthly"];
  return ["daily", "monthly"];
}

export function getDateRange(granularity: ReportGranularity): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  switch (granularity) {
    case "weekly":
      start.setDate(start.getDate() - 7 * 11);
      break;
    case "biweekly":
      start.setDate(start.getDate() - 14 * 11);
      break;
    case "monthly":
      start.setMonth(start.getMonth() - 11);
      start.setDate(1);
      break;
    default:
      start.setDate(start.getDate() - 29);
      break;
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/** Previous window of equal length, ending just before the current range starts. */
export function getPreviousDateRange(granularity: ReportGranularity): { start: Date; end: Date } {
  const { start, end } = getDateRange(granularity);
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  prevStart.setHours(0, 0, 0, 0);
  return { start: prevStart, end: prevEnd };
}

export function formatDateRangeLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString()} – ${e.toLocaleDateString()}`;
}

export function granularityLabel(granularity: ReportGranularity) {
  switch (granularity) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Biweekly";
    case "monthly":
      return "Monthly";
    default:
      return "Daily";
  }
}
