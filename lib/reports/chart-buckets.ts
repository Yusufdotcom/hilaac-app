import type { ReportGranularity, RevenueBucket } from "@/lib/reports/types";
import { APP_TIMEZONE, zonedMidnightToUtc } from "@/lib/time/app-calendar";

/** Chart / export x-axis bucketing (independent of selected timeframe window). */
export type ChartBucketGranularity = "hourly" | "daily" | "monthly";

/**
 * Single mapping used by on-page charts AND PDF/Excel revenue breakdown.
 * Daily → hourly (24 points). Weekly/Biweekly/Monthly → daily. Yearly → monthly.
 */
export function getChartBucketGranularity(
  timeframe: ReportGranularity
): ChartBucketGranularity {
  switch (timeframe) {
    case "daily":
      return "hourly";
    case "yearly":
      return "monthly";
    case "weekly":
    case "biweekly":
    case "monthly":
    default:
      return "daily";
  }
}

function formatInAppTz(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: APP_TIMEZONE }).format(date);
}

function labelForBucket(bucketStart: Date, granularity: ChartBucketGranularity): string {
  switch (granularity) {
    case "hourly": {
      const hour = getZonedParts(bucketStart).hour;
      return `${String(hour).padStart(2, "0")}:00`;
    }
    case "monthly":
      return formatInAppTz(bucketStart, { month: "short", year: "numeric" });
    case "daily":
    default:
      return formatInAppTz(bucketStart, { month: "short", day: "numeric" });
  }
}

function getZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: n("year"), month: n("month"), day: n("day"), hour: n("hour") };
}

function nextBucket(start: Date, granularity: ChartBucketGranularity): Date {
  const p = getZonedParts(start);
  if (granularity === "hourly") {
    // Advance one hour in app TZ via UTC ms (EAT has no DST).
    return new Date(start.getTime() + 60 * 60 * 1000);
  }
  if (granularity === "monthly") {
    const nm = p.month === 12 ? 1 : p.month + 1;
    const ny = p.month === 12 ? p.year + 1 : p.year;
    return zonedMidnightToUtc(ny, nm, 1);
  }
  // daily
  const anchor = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
  anchor.setUTCDate(anchor.getUTCDate() + 1);
  return zonedMidnightToUtc(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + 1,
    anchor.getUTCDate()
  );
}

function alignBucketStart(instant: Date, granularity: ChartBucketGranularity): Date {
  const p = getZonedParts(instant);
  if (granularity === "hourly") {
    // Midnight of day + hour offset in EAT (= UTC+3 fixed).
    const dayStart = zonedMidnightToUtc(p.year, p.month, p.day);
    return new Date(dayStart.getTime() + p.hour * 60 * 60 * 1000);
  }
  if (granularity === "monthly") {
    return zonedMidnightToUtc(p.year, p.month, 1);
  }
  return zonedMidnightToUtc(p.year, p.month, p.day);
}

/**
 * Zero-fill every bucket in [rangeStart, rangeEnd) so charts never go blank
 * when the window is short (e.g. Daily → 24 hourly slots).
 */
export function fillRevenueBuckets(
  sparse: RevenueBucket[],
  rangeStart: Date,
  rangeEnd: Date,
  granularity: ChartBucketGranularity
): RevenueBucket[] {
  const byKey = new Map<string, RevenueBucket>();
  for (const row of sparse) {
    if (!row.period_start) continue;
    const key = new Date(row.period_start).toISOString();
    byKey.set(key, row);
  }

  const out: RevenueBucket[] = [];
  let cursor = alignBucketStart(rangeStart, granularity);
  // If align snapped before range start (shouldn't for day/month), clamp forward.
  if (cursor.getTime() < rangeStart.getTime()) {
    cursor = nextBucket(cursor, granularity);
  }

  while (cursor.getTime() < rangeEnd.getTime()) {
    const key = cursor.toISOString();
    const existing = byKey.get(key);
    out.push(
      existing ?? {
        period_start: key,
        period_label: labelForBucket(cursor, granularity),
        order_count: 0,
        revenue: 0,
      }
    );
    cursor = nextBucket(cursor, granularity);
  }

  return out;
}
