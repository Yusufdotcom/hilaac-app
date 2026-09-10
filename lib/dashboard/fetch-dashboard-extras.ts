import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppDayBounds, getZonedYmd } from "@/lib/time/app-calendar";
import { fetchReportData } from "@/lib/reports/fetch-report-data";

export type DashboardSparklines = {
  orders: number[];
  revenue: number[];
  /** Open (non-completed/delivered) orders created each of the last 7 days. */
  openOrders: number[];
  /** No historical table occupancy — empty so the card shows flat bars. */
  activeTables: number[];
};

export type DashboardTip = {
  title: string;
  message: string;
  /** When set, UI shows "Today's Briefing" instead of tip. */
  kind?: "tip" | "briefing";
};

const TIP_FALLBACK: DashboardTip = {
  title: "Today's tip",
  message: "No tip yet — place a few paid orders to unlock insights.",
  kind: "tip",
};

function emptySeven(): number[] {
  return [0, 0, 0, 0, 0, 0, 0];
}

function todayYmd(): string {
  const ymd = getZonedYmd(new Date());
  return `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;
}

/**
 * Last 7 app-days of paid order_count + revenue via get_revenue_by_period,
 * plus open-order day buckets and a tip from the daily Insights engine.
 * Prefer today's AI briefing when present.
 */
export async function fetchDashboardExtras(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<{
  sparklines: DashboardSparklines;
  tip: DashboardTip;
  menuItemCount: number;
  sparklineError: string | null;
  tipError: string | null;
}> {
  const { start: seriesStart } = getAppDayBounds(-6);
  const { end: seriesEnd } = getAppDayBounds(0);
  const startIso = seriesStart.toISOString();
  const endIso = seriesEnd.toISOString();
  const briefingDate = todayYmd();

  const [revenueRes, openOrdersRes, menuCountRes, tipResult, briefingRes] = await Promise.all([
    supabase.rpc("get_revenue_by_period", {
      p_restaurant_id: restaurantId,
      p_start_date: startIso,
      p_end_date: endIso,
      p_granularity: "daily",
    }),
    supabase
      .from("orders")
      .select("created_at, status")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .neq("status", "completed")
      .neq("status", "delivered")
      .neq("status", "cancelled"),
    supabase
      .from("menu_items")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    fetchReportData(supabase, restaurantId, "daily", 0)
      .then((data) => ({ tip: pickTip(data.insights), error: null as string | null }))
      .catch((err: unknown) => ({
        tip: TIP_FALLBACK,
        error: err instanceof Error ? err.message : "Could not load tip",
      })),
    supabase
      .from("daily_briefings")
      .select("content, language")
      .eq("restaurant_id", restaurantId)
      .eq("briefing_date", briefingDate)
      .maybeSingle(),
  ]);

  let sparklineError: string | null = null;
  const sparklines: DashboardSparklines = {
    orders: emptySeven(),
    revenue: emptySeven(),
    openOrders: emptySeven(),
    activeTables: emptySeven(),
  };

  if (revenueRes.error) {
    sparklineError = revenueRes.error.message;
  } else {
    const byDay = new Map<string, { orders: number; revenue: number }>();
    for (const raw of (revenueRes.data as unknown[]) ?? []) {
      const row = raw as Record<string, unknown>;
      const start = String(row.period_start ?? "");
      const key = start.slice(0, 10);
      byDay.set(key, {
        orders: Number(row.order_count ?? 0) || 0,
        revenue: Number(row.revenue ?? 0) || 0,
      });
    }
    for (let i = 0; i < 7; i++) {
      const { start } = getAppDayBounds(-6 + i);
      const key = start.toISOString().slice(0, 10);
      const ymd = getAppDayBounds(-6 + i).ymd;
      const localKey = `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;
      const hit = byDay.get(localKey) ?? byDay.get(key) ?? { orders: 0, revenue: 0 };
      sparklines.orders[i] = hit.orders;
      sparklines.revenue[i] = hit.revenue;
    }
  }

  if (openOrdersRes.error) {
    sparklineError = sparklineError ?? openOrdersRes.error.message;
  } else {
    const counts = emptySeven();
    for (const row of openOrdersRes.data ?? []) {
      const t = new Date(row.created_at as string).getTime();
      for (let i = 0; i < 7; i++) {
        const { start, end } = getAppDayBounds(-6 + i);
        if (t >= start.getTime() && t < end.getTime()) {
          counts[i] += 1;
          break;
        }
      }
    }
    sparklines.openOrders = counts;
  }

  const briefingContent = briefingRes.data?.content?.trim();
  const tip: DashboardTip =
    briefingContent && !briefingRes.error
      ? {
          title: "Today's Briefing",
          message: briefingContent,
          kind: "briefing",
        }
      : { ...tipResult.tip, kind: tipResult.tip.kind ?? "tip" };

  return {
    sparklines,
    tip,
    menuItemCount: menuCountRes.count ?? 0,
    sparklineError,
    tipError: briefingContent ? null : tipResult.error,
  };
}

function pickTip(
  insights: { title: string; message: string; importance: number }[]
): DashboardTip {
  if (!insights?.length) return TIP_FALLBACK;
  const sorted = [...insights].sort((a, b) => b.importance - a.importance);
  const top = sorted[0];
  return { title: top.title, message: top.message, kind: "tip" };
}
