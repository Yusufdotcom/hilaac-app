import type { SupabaseClient } from "@supabase/supabase-js";
import { formatAppDate, getAppMonthBounds } from "@/lib/time/app-calendar";
import {
  hoursFromRestaurant,
  lastCompletedBusinessDay,
  previousCompletedBusinessDay,
  type BusinessDayWindow,
  type BusinessHours,
} from "@/lib/recap/business-hours";
import { formatCurrency } from "@/lib/utils";

export type RecapKpi = {
  orders: number;
  revenue: number;
  topItemName: string | null;
  topItemQuantity: number;
};

export type RecapComparison = {
  ordersDeltaPct: number | null;
  revenueDeltaPct: number | null;
  previousOrders: number;
  previousRevenue: number;
};

export type DailyRecap = {
  kind: "daily";
  window: BusinessDayWindow;
  previousWindow: BusinessDayWindow | null;
  kpi: RecapKpi;
  comparison: RecapComparison;
  headline: string;
  body: string;
};

export type MonthlyRecap = {
  kind: "monthly";
  monthLabel: string;
  start: string;
  end: string;
  kpi: RecapKpi;
  topItems: { name: string; quantity: number; revenue: number }[];
  bestDay: { label: string; orders: number; revenue: number } | null;
  comparison: RecapComparison;
  previousMonthLabel: string;
  headline: string;
  body: string;
};

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0 && current <= 0) return 0;
  if (previous <= 0) return 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function parseKpiRow(row: Record<string, unknown> | undefined): RecapKpi {
  const topRaw = row?.top_item_name;
  const topQty = Number(row?.top_item_quantity ?? 0) || 0;
  const topItemName =
    topRaw && String(topRaw).trim() && String(topRaw) !== "—" && topQty > 0
      ? String(topRaw)
      : null;
  return {
    orders: Number(row?.total_orders ?? 0) || 0,
    revenue: Number(row?.total_revenue ?? 0) || 0,
    topItemName,
    topItemQuantity: topItemName ? topQty : 0,
  };
}

async function kpiForRange(
  supabase: SupabaseClient,
  restaurantId: string,
  start: Date,
  end: Date
): Promise<RecapKpi> {
  const { data, error } = await supabase.rpc("get_kpi_summary", {
    p_restaurant_id: restaurantId,
    p_start_date: start.toISOString(),
    p_end_date: end.toISOString(),
  });
  if (!error) {
    return parseKpiRow((data?.[0] ?? {}) as Record<string, unknown>);
  }

  const { data: orders, error: orderErr } = await supabase
    .from("orders")
    .select("id, total")
    .eq("restaurant_id", restaurantId)
    .eq("payment_status", "paid")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (orderErr) throw new Error(`get_kpi_summary: ${error.message}`);

  const ids = (orders ?? []).map((o) => o.id);
  const ordersCount = ids.length;
  const revenue = (orders ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
  let topItemName: string | null = null;
  let topItemQuantity = 0;
  if (ids.length) {
    const { data: items } = await supabase
      .from("order_items")
      .select("quantity, menu_item:menu_item_id(name)")
      .in("order_id", ids);
    const qty = new Map<string, number>();
    for (const row of items ?? []) {
      const label = menuItemName((row as { menu_item?: unknown }).menu_item);
      qty.set(label, (qty.get(label) ?? 0) + (Number(row.quantity) || 0));
    }
    for (const [name, q] of qty) {
      if (q > topItemQuantity) {
        topItemName = name;
        topItemQuantity = q;
      }
    }
  }
  return { orders: ordersCount, revenue, topItemName, topItemQuantity };
}

function menuItemName(menuItem: unknown): string {
  if (Array.isArray(menuItem)) {
    const n = (menuItem[0] as { name?: string } | undefined)?.name;
    return n?.trim() || "Unknown";
  }
  if (menuItem && typeof menuItem === "object" && "name" in menuItem) {
    const n = (menuItem as { name?: string }).name;
    return n?.trim() || "Unknown";
  }
  return "Unknown";
}

function comparison(current: RecapKpi, previous: RecapKpi | null): RecapComparison {
  if (!previous) {
    return {
      ordersDeltaPct: null,
      revenueDeltaPct: null,
      previousOrders: 0,
      previousRevenue: 0,
    };
  }
  return {
    ordersDeltaPct: deltaPct(current.orders, previous.orders),
    revenueDeltaPct: deltaPct(current.revenue, previous.revenue),
    previousOrders: previous.orders,
    previousRevenue: previous.revenue,
  };
}

function vsPhrase(pct: number | null, unit: string, previous: number): string {
  if (previous <= 0) return currentPositive(pct) ? `there were no paid sales the ${unit} before` : "";
  if (pct == null) return "";
  if (Math.abs(pct) < 0.5) return `about even with the ${unit} before`;
  if (pct > 0) return `${Math.abs(Math.round(pct))}% ahead of the ${unit} before`;
  return `${Math.abs(Math.round(pct))}% quieter than the ${unit} before`;
}

function currentPositive(pct: number | null): boolean {
  return pct != null && pct > 0;
}

function dailyCopy(
  restaurantName: string,
  window: BusinessDayWindow,
  kpi: RecapKpi,
  cmp: RecapComparison
): { headline: string; body: string } {
  if (kpi.orders <= 0) {
    return {
      headline: `A quiet close on ${window.label}`,
      body: `${restaurantName} didn’t ring up any paid orders that shift. Recap follows ${window.hoursLabel}.`,
    };
  }
  const vs = vsPhrase(cmp.revenueDeltaPct, "day", cmp.previousRevenue);
  const item = kpi.topItemName
    ? ` ${kpi.topItemName} led the board with ${kpi.topItemQuantity} sold.`
    : "";
  const rev = cmp.previousRevenue > 0 ? (cmp.revenueDeltaPct ?? 0) : 0;
  return {
    headline:
      rev > 15
        ? `${window.label} was one of your stronger days`
        : rev < -15
          ? `${window.label} came in quieter than the day before`
          : `Here’s how ${window.label} wrapped up`,
    body: `${restaurantName} closed with ${kpi.orders} paid order${kpi.orders === 1 ? "" : "s"} totaling ${formatCurrency(kpi.revenue)}${vs ? ` — ${vs}.` : "."}${item}`,
  };
}

function monthlyCopy(
  restaurantName: string,
  monthLabel: string,
  kpi: RecapKpi,
  cmp: RecapComparison,
  bestDay: MonthlyRecap["bestDay"],
  topItems: MonthlyRecap["topItems"]
): { headline: string; body: string } {
  if (kpi.orders <= 0) {
    return {
      headline: `${monthLabel} had no paid sales`,
      body: `${restaurantName} didn’t record paid orders last month. When the next month starts, this recap will fill in.`,
    };
  }
  const vs = vsPhrase(cmp.revenueDeltaPct, "month", cmp.previousRevenue);
  const top = topItems[0]?.name
    ? ` ${topItems[0].name} was the month’s favorite.`
    : "";
  const best = bestDay
    ? ` Best single day was ${bestDay.label} (${formatCurrency(bestDay.revenue)}).`
    : "";
  return {
    headline: bestDay
      ? `${monthLabel}’s best day was ${bestDay.label}`
      : `${monthLabel} wrapped up`,
    body: `${restaurantName} finished the month with ${kpi.orders} orders and ${formatCurrency(kpi.revenue)}${vs ? ` — ${vs}.` : "."}${top}${best}`,
  };
}

export async function fetchDailyRecap(
  supabase: SupabaseClient,
  restaurant: {
    id: string;
    name: string;
    opening_time?: string | null;
    closing_time?: string | null;
    business_days?: number[] | null;
  },
  now: Date = new Date()
): Promise<DailyRecap> {
  const hours: BusinessHours = hoursFromRestaurant(restaurant);
  const window = lastCompletedBusinessDay(hours, now);
  const previousWindow = previousCompletedBusinessDay(hours, window, now);
  const [kpi, prevKpi] = await Promise.all([
    kpiForRange(supabase, restaurant.id, window.start, window.end),
    previousWindow
      ? kpiForRange(supabase, restaurant.id, previousWindow.start, previousWindow.end)
      : Promise.resolve(null),
  ]);
  const cmp = comparison(kpi, prevKpi);
  const copy = dailyCopy(restaurant.name, window, kpi, cmp);
  return {
    kind: "daily",
    window,
    previousWindow,
    kpi,
    comparison: cmp,
    ...copy,
  };
}

export async function fetchMonthlyRecap(
  supabase: SupabaseClient,
  restaurant: { id: string; name: string },
  now: Date = new Date()
): Promise<MonthlyRecap> {
  const completed = getAppMonthBounds(-1, now);
  const prior = getAppMonthBounds(-2, now);

  const rpcBase = {
    p_restaurant_id: restaurant.id,
    p_start_date: completed.start.toISOString(),
    p_end_date: completed.end.toISOString(),
  };

  const [kpi, prevKpi, topRes, bucketsRes] = await Promise.all([
    kpiForRange(supabase, restaurant.id, completed.start, completed.end),
    kpiForRange(supabase, restaurant.id, prior.start, prior.end),
    supabase.rpc("get_top_items", { ...rpcBase, p_limit: 3 }),
    supabase.rpc("get_revenue_by_period", { ...rpcBase, p_granularity: "daily" }),
  ]);

  let topItems: MonthlyRecap["topItems"] = [];
  if (!topRes.error) {
    topItems = ((topRes.data ?? []) as Record<string, unknown>[])
      .map((row) => ({
        name: String(row.item_name ?? row.name ?? "Unknown"),
        quantity: Number(row.quantity_sold ?? row.quantity ?? 0) || 0,
        revenue: Number(row.revenue ?? 0) || 0,
      }))
      .filter((i) => i.quantity > 0)
      .slice(0, 3);
  } else if (kpi.topItemName) {
    topItems = [{ name: kpi.topItemName, quantity: kpi.topItemQuantity, revenue: 0 }];
  }

  let bestDay: MonthlyRecap["bestDay"] = null;
  if (!bucketsRes.error) {
    for (const raw of (bucketsRes.data ?? []) as Record<string, unknown>[]) {
      const revenue = Number(raw.revenue ?? 0) || 0;
      const orders = Number(raw.order_count ?? 0) || 0;
      if (revenue <= 0) continue;
      if (!bestDay || revenue > bestDay.revenue) {
        const start = String(raw.period_start ?? "");
        bestDay = {
          label: start
            ? formatAppDate(start, { weekday: "short", month: "short", day: "numeric" })
            : String(raw.period_label ?? ""),
          orders,
          revenue,
        };
      }
    }
  } else {
    const { data: monthOrders } = await supabase
      .from("orders")
      .select("total, created_at")
      .eq("restaurant_id", restaurant.id)
      .eq("payment_status", "paid")
      .gte("created_at", completed.start.toISOString())
      .lt("created_at", completed.end.toISOString());
    const byDay = new Map<string, { orders: number; revenue: number }>();
    for (const row of monthOrders ?? []) {
      const label = formatAppDate(row.created_at, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const cur = byDay.get(label) ?? { orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += Number(row.total ?? 0);
      byDay.set(label, cur);
    }
    for (const [label, v] of byDay) {
      if (!bestDay || v.revenue > bestDay.revenue) bestDay = { label, ...v };
    }
  }

  const monthLabel = formatAppDate(completed.start, { month: "long", year: "numeric" });
  const previousMonthLabel = formatAppDate(prior.start, { month: "long", year: "numeric" });
  const cmp = comparison(kpi, prevKpi);
  const copy = monthlyCopy(restaurant.name, monthLabel, kpi, cmp, bestDay, topItems);

  return {
    kind: "monthly",
    monthLabel,
    start: completed.start.toISOString(),
    end: completed.end.toISOString(),
    kpi,
    topItems,
    bestDay,
    comparison: cmp,
    previousMonthLabel,
    ...copy,
  };
}
