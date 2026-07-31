import type {
  ItemStat,
  PaymentSplitStat,
  PeakHourStat,
  ReportGranularity,
  ReportInsight,
  ReportInsightType,
} from "@/lib/reports/types";

const TREND_MIN_GROWTH = 25;
const TREND_MIN_QTY = 5;
const UNDERPERFORM_MAX = 3;
const PEAK_SHARE_THRESHOLD = 30;
const PAYMENT_SHARE_THRESHOLD = 70;
const REVENUE_TREND_THRESHOLD = 20;
const MAX_INSIGHTS = 4;

export type ComputeInsightsInput = {
  granularity: ReportGranularity;
  /** Current-period item stats (prefer a wider list than Top 10). */
  currentItems: ItemStat[];
  previousItems: ItemStat[];
  /** Items sold in the last 14 calendar days (absolute, not report period). */
  recent14Items: ItemStat[];
  /** Items sold in the 30 days before that 14-day window. */
  prior30Items: ItemStat[];
  peakHours: PeakHourStat[];
  paymentSplit: PaymentSplitStat[];
  revenueTrendPercent: number | null;
  revenueTrendDirection: "up" | "down" | "flat";
};

function timeframeNoun(granularity: ReportGranularity): string {
  switch (granularity) {
    case "weekly":
      return "week";
    case "biweekly":
      return "two weeks";
    case "monthly":
      return "month";
    case "yearly":
      return "year";
    default:
      return "day";
  }
}

function thisTimeframeLabel(granularity: ReportGranularity): string {
  return granularity === "daily" ? "today" : `this ${timeframeNoun(granularity)}`;
}

function lastTimeframeLabel(granularity: ReportGranularity): string {
  return granularity === "daily" ? "yesterday" : `last ${timeframeNoun(granularity)}`;
}

function formatHourLabel(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const suffix = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

function roundPct(n: number): number {
  return Math.round(n);
}

/**
 * Best contiguous 2-hour block by order count, with share of period totals.
 */
export function findPeakTwoHourBlock(peakHours: PeakHourStat[]): {
  startHour: number;
  endHour: number;
  orderCount: number;
  sharePercent: number;
} | null {
  if (!peakHours.length) return null;

  const byHour = new Map<number, number>();
  let total = 0;
  for (const row of peakHours) {
    const hour = Number(row.hour_of_day);
    const count = Number(row.order_count) || 0;
    byHour.set(hour, (byHour.get(hour) ?? 0) + count);
    total += count;
  }
  if (total <= 0) return null;

  let best: { startHour: number; orderCount: number } | null = null;
  for (let h = 0; h < 24; h++) {
    const combined = (byHour.get(h) ?? 0) + (byHour.get((h + 1) % 24) ?? 0);
    // Skip wrap-around midnight blocks unless both hours have data — keep linear day windows only.
    if (h === 23) continue;
    if (!best || combined > best.orderCount) {
      best = { startHour: h, orderCount: combined };
    }
  }

  if (!best || best.orderCount <= 0) return null;

  return {
    startHour: best.startHour,
    endHour: best.startHour + 2,
    orderCount: best.orderCount,
    sharePercent: (best.orderCount / total) * 100,
  };
}

/**
 * Pure rule engine — no I/O. Returns at most MAX_INSIGHTS, importance-sorted.
 */
export function computeInsights(input: ComputeInsightsInput): ReportInsight[] {
  const candidates: ReportInsight[] = [];
  const thisTf = thisTimeframeLabel(input.granularity);
  const lastTf = lastTimeframeLabel(input.granularity);

  // 1) Trending item (up)
  const prevMap = new Map(input.previousItems.map((i) => [i.item_name, i.quantity_sold]));
  const trending = input.currentItems
    .map((item) => {
      const prevQty = prevMap.get(item.item_name) ?? 0;
      if (item.quantity_sold < TREND_MIN_QTY || prevQty <= 0) return null;
      const growth = ((item.quantity_sold - prevQty) / prevQty) * 100;
      if (growth < TREND_MIN_GROWTH) return null;
      const pct = roundPct(growth);
      return {
        id: `trending:${item.item_name}`,
        type: "trending_up" as ReportInsightType,
        title: "Trending item",
        message: `${item.item_name} is trending up ${pct}% ${thisTf} — consider featuring it or checking stock.`,
        importance: 50 + Math.min(pct, 200),
        meta: {
          itemName: item.item_name,
          percent: pct,
          currentQty: item.quantity_sold,
          previousQty: prevQty,
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.importance - a.importance);

  // Keep the single strongest trending signal (avoid crowding the cap).
  if (trending[0]) candidates.push(trending[0]);

  // 2) Underperforming items (fixed 14d / prior 30d windows)
  const recentNames = new Set(
    input.recent14Items.filter((i) => i.quantity_sold > 0).map((i) => i.item_name)
  );
  const under = input.prior30Items
    .filter((i) => i.quantity_sold >= TREND_MIN_QTY && !recentNames.has(i.item_name))
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, UNDERPERFORM_MAX)
    .map((item, idx) => ({
      id: `underperforming:${item.item_name}`,
      type: "underperforming" as ReportInsightType,
      title: "Underperforming item",
      message: `${item.item_name} hasn't sold in 14 days — consider a promotion or removing it from the menu.`,
      importance: 40 + item.quantity_sold - idx,
      meta: {
        itemName: item.item_name,
        daysWithoutSale: 14,
        previousQty: item.quantity_sold,
      },
    }));
  candidates.push(...under);

  // 3) Peak hours
  const peak = findPeakTwoHourBlock(input.peakHours);
  if (peak && peak.sharePercent > PEAK_SHARE_THRESHOLD) {
    const pct = roundPct(peak.sharePercent);
    const startLabel = formatHourLabel(peak.startHour);
    const endLabel = formatHourLabel(peak.endHour);
    candidates.push({
      id: `peak:${peak.startHour}-${peak.endHour}`,
      type: "peak_hours",
      title: "Peak hours",
      message: `${pct}% of your orders happen between ${startLabel}–${endLabel} — consider extra staff during this window.`,
      importance: 35 + pct,
      meta: {
        percent: pct,
        startHour: peak.startHour,
        endHour: peak.endHour,
      },
    });
  }

  // 4) Payment concentration
  const payTotal = input.paymentSplit.reduce((s, p) => s + (Number(p.order_count) || 0), 0);
  if (payTotal > 0) {
    const top = [...input.paymentSplit].sort(
      (a, b) => (Number(b.order_count) || 0) - (Number(a.order_count) || 0)
    )[0];
    if (top) {
      const share = ((Number(top.order_count) || 0) / payTotal) * 100;
      if (share > PAYMENT_SHARE_THRESHOLD) {
        const pct = roundPct(share);
        candidates.push({
          id: `payment:${top.payment_method}`,
          type: "payment_concentration",
          title: "Payment concentration",
          message: `${pct}% of payments are via ${top.payment_method} — make sure this option is fast and reliable for customers.`,
          importance: 30 + pct,
          meta: {
            percent: pct,
            paymentMethod: top.payment_method,
          },
        });
      }
    }
  }

  // 5) Revenue trend summary (±20%+)
  if (
    input.revenueTrendPercent != null &&
    input.revenueTrendDirection !== "flat" &&
    Math.abs(input.revenueTrendPercent) >= REVENUE_TREND_THRESHOLD
  ) {
    const pct = roundPct(Math.abs(input.revenueTrendPercent));
    const dir = input.revenueTrendDirection === "up" ? "up" : "down";
    candidates.push({
      id: `revenue:${dir}:${pct}`,
      type: "revenue_trend",
      title: "Revenue trend",
      message: `Revenue is ${dir} ${pct}% compared to ${lastTf}.`,
      importance: 60 + pct,
      meta: {
        percent: pct,
        direction: input.revenueTrendDirection,
      },
    });
  }

  return candidates.sort((a, b) => b.importance - a.importance).slice(0, MAX_INSIGHTS);
}
