import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ItemStat,
  KpiTrend,
  PaymentSplitStat,
  PeakDayStat,
  ReportData,
  ReportGranularity,
  RevenueBucket,
  SpikedItem,
  WaiterPerformanceStat,
} from "@/lib/reports/types";
import {
  APP_TIMEZONE,
  fillRevenueBuckets,
  getChartBucketGranularity,
  getDateRange,
  getPreviousDateRange,
} from "@/lib/reports/timeframes";

function mapRpcError(label: string, error: { message: string } | null, params?: Record<string, unknown>) {
  if (error) {
    console.error(`[reports] ${label} failed`, { error: error.message, params });
    throw new Error(`${label}: ${error.message}`);
  }
}

function trendFromValues(current: number, previous: number): KpiTrend {
  if (previous <= 0 && current <= 0) {
    return { percent: 0, direction: "flat", current, previous };
  }
  if (previous <= 0) {
    return { percent: 100, direction: "up", current, previous };
  }
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.5) {
    return { percent: 0, direction: "flat", current, previous };
  }
  return {
    percent: Math.round(percent * 10) / 10,
    direction: percent > 0 ? "up" : "down",
    current,
    previous,
  };
}

function normalizeItems(rows: unknown[]): ItemStat[] {
  return (rows ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      item_name: String(row.item_name ?? row.name ?? "Unknown item"),
      quantity_sold: Number(row.quantity_sold ?? row.quantity ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });
}

function normalizeRevenue(rows: unknown[]): RevenueBucket[] {
  return (rows ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      period_start: String(row.period_start ?? ""),
      period_label: String(row.period_label ?? ""),
      order_count: Number(row.order_count ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });
}

function normalizePayment(rows: unknown[]): PaymentSplitStat[] {
  const mapped = (rows ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const method = String(row.payment_method ?? "CASH").toUpperCase();
    return {
      payment_method: method === "EDAHAB" ? "eDahab" : method === "EVC" ? "EVC" : method === "CASH" ? "Cash" : method,
      order_count: Number(row.order_count ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });

  const ensure = ["EVC", "eDahab", "Cash"] as const;
  return ensure.map((m) => {
    const found = mapped.find((r) => r.payment_method.toLowerCase() === m.toLowerCase());
    return found ?? { payment_method: m, order_count: 0, revenue: 0 };
  });
}

function normalizeWaiters(rows: unknown[]): WaiterPerformanceStat[] {
  return (rows ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      waiter_name: String(row.waiter_name ?? "Unknown"),
      deliveries: Number(row.deliveries ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });
}

function normalizePeakDays(rows: unknown[]): PeakDayStat[] {
  return (rows ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      day_of_week: Number(row.day_of_week ?? 0),
      day_label: String(row.day_label ?? ""),
      order_count: Number(row.order_count ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });
}

function computeSpikedItems(current: ItemStat[], previous: ItemStat[]): SpikedItem[] {
  const prevMap = new Map(previous.map((i) => [i.item_name, i.quantity_sold]));

  return current
    .map((item) => {
      const qty = item.quantity_sold;
      const prevQty = prevMap.get(item.item_name) ?? 0;
      let growth = 0;
      if (prevQty <= 0 && qty > 0) growth = 100;
      else if (prevQty > 0) growth = ((qty - prevQty) / prevQty) * 100;
      return {
        item_name: item.item_name,
        quantity_sold: qty,
        previous_quantity: prevQty,
        growth_percent: Math.round(growth),
      };
    })
    .filter((s) => s.growth_percent > 0 && s.quantity_sold > 0)
    .sort((a, b) => b.growth_percent - a.growth_percent)
    .slice(0, 2);
}

/**
 * Fetches all Insights datasets for one timeframe using a single shared
 * { start, end } window — never mix lifetime / alternate ranges.
 */
export async function fetchReportData(
  supabase: SupabaseClient,
  restaurantId: string,
  granularity: ReportGranularity,
  periodOffset = 0
): Promise<ReportData> {
  const { start, end } = getDateRange(granularity, periodOffset);
  const prev = getPreviousDateRange(granularity, periodOffset);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const prevStartIso = prev.start.toISOString();
  const prevEndIso = prev.end.toISOString();

  // Exact same bounds for every RPC in this request.
  const rpcBase = {
    p_restaurant_id: restaurantId,
    p_start_date: startIso,
    p_end_date: endIso,
  };

  const prevRpcBase = {
    p_restaurant_id: restaurantId,
    p_start_date: prevStartIso,
    p_end_date: prevEndIso,
  };

  console.info("[reports] fetchReportData", {
    restaurantId,
    granularity,
    periodOffset,
    timezone: APP_TIMEZONE,
    p_start_date: startIso,
    p_end_date: endIso,
  });

  // Chart buckets are finer than the selected window (e.g. daily points inside a week).
  const chartGranularity = getChartBucketGranularity(granularity);

  const [
    kpiRes,
    prevKpiRes,
    revenueRes,
    prevRevenueRes,
    topItemsRes,
    prevTopItemsRes,
    leastItemsRes,
    peakHoursRes,
    peakDaysRes,
    paymentSplitRes,
    waiterPerfRes,
  ] = await Promise.all([
    supabase.rpc("get_kpi_summary", rpcBase),
    supabase.rpc("get_kpi_summary", prevRpcBase),
    supabase.rpc("get_revenue_by_period", { ...rpcBase, p_granularity: chartGranularity }),
    supabase.rpc("get_revenue_by_period", {
      ...prevRpcBase,
      p_granularity: chartGranularity,
    }),
    supabase.rpc("get_top_items", { ...rpcBase, p_limit: 10 }),
    supabase.rpc("get_top_items", { ...prevRpcBase, p_limit: 25 }),
    supabase.rpc("get_least_ordered_items", { ...rpcBase, p_limit: 5 }),
    supabase.rpc("get_peak_hours", rpcBase),
    supabase.rpc("get_peak_days", rpcBase),
    supabase.rpc("get_payment_split", rpcBase),
    supabase.rpc("get_waiter_performance", rpcBase),
  ]);

  mapRpcError("get_kpi_summary", kpiRes.error, rpcBase);
  mapRpcError("get_kpi_summary(prev)", prevKpiRes.error, prevRpcBase);
  mapRpcError("get_revenue_by_period", revenueRes.error, {
    ...rpcBase,
    granularity: chartGranularity,
  });
  mapRpcError("get_revenue_by_period(prev)", prevRevenueRes.error, {
    ...prevRpcBase,
    granularity: chartGranularity,
  });
  mapRpcError("get_top_items", topItemsRes.error, { ...rpcBase, p_limit: 10 });
  mapRpcError("get_top_items(prev)", prevTopItemsRes.error, { ...prevRpcBase, p_limit: 25 });
  mapRpcError("get_least_ordered_items", leastItemsRes.error, { ...rpcBase, p_limit: 5 });
  mapRpcError("get_peak_hours", peakHoursRes.error, rpcBase);
  mapRpcError("get_peak_days", peakDaysRes.error, rpcBase);
  mapRpcError("get_payment_split", paymentSplitRes.error, rpcBase);
  mapRpcError("get_waiter_performance", waiterPerfRes.error, rpcBase);

  const kpiRow = (kpiRes.data?.[0] ?? {}) as Record<string, unknown>;
  const prevKpiRow = (prevKpiRes.data?.[0] ?? {}) as Record<string, unknown>;

  const totalOrders = Number(kpiRow.total_orders ?? 0);
  const totalRevenue = Number(kpiRow.total_revenue ?? 0);
  const avgOrderValue = Number(kpiRow.avg_order_value ?? kpiRow.average_order_value ?? 0);
  const itemsSold =
    kpiRow.items_sold != null
      ? Number(kpiRow.items_sold)
      : normalizeItems(topItemsRes.data ?? []).reduce((s, i) => s + i.quantity_sold, 0);

  const prevOrders = Number(prevKpiRow.total_orders ?? 0);
  const prevRevenue = Number(prevKpiRow.total_revenue ?? 0);
  const prevAov = Number(prevKpiRow.avg_order_value ?? prevKpiRow.average_order_value ?? 0);

  const topItems = normalizeItems(topItemsRes.data ?? []).filter((i) => i.quantity_sold > 0);
  const prevTopItems = normalizeItems(prevTopItemsRes.data ?? []);
  const leastItems = normalizeItems(leastItemsRes.data ?? []).filter((i) => i.quantity_sold > 0);

  // Zero-fill buckets so Daily (hourly) always has 24 points, etc.
  const revenue = fillRevenueBuckets(
    normalizeRevenue(revenueRes.data ?? []),
    start,
    end,
    chartGranularity
  );
  const previousRevenue = fillRevenueBuckets(
    normalizeRevenue(prevRevenueRes.data ?? []),
    prev.start,
    prev.end,
    chartGranularity
  );
  const peakDays = normalizePeakDays(peakDaysRes.data ?? []);

  // Top selling item: only if sold in this timeframe (prefer top_items for alignment).
  const topSold = topItems[0];
  const top_item_name =
    topSold && topSold.quantity_sold > 0
      ? topSold.item_name
      : (() => {
          const raw = kpiRow.top_item_name ?? kpiRow.top_selling_item;
          if (raw == null || raw === "" || raw === "—") return null;
          const qty = Number(kpiRow.top_item_quantity ?? 0) || 0;
          return qty > 0 ? String(raw) : null;
        })();
  const top_item_quantity =
    topSold && topSold.quantity_sold > 0
      ? topSold.quantity_sold
      : top_item_name
        ? Number(kpiRow.top_item_quantity ?? 0) || 0
        : 0;

  // Sanity: an order cannot have fewer than 1 item unit.
  if (totalOrders > itemsSold) {
    console.warn("[reports] SANITY FAIL: total_orders > items_sold (possible join fanout)", {
      restaurantId,
      granularity,
      periodOffset,
      startDate: startIso,
      endDate: endIso,
      totalOrders,
      itemsSold,
    });
  }

  const expectedAov = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;
  if (totalOrders > 0 && Math.abs(expectedAov - avgOrderValue) > 0.02) {
    console.warn("[reports] SANITY FAIL: AOV mismatch", {
      restaurantId,
      granularity,
      avgOrderValue,
      expectedAov,
      totalRevenue,
      totalOrders,
    });
  }

  const chartSum = revenue.reduce((sum, row) => sum + row.revenue, 0);
  if (Math.abs(chartSum - totalRevenue) > 0.05) {
    console.error("[reports] revenue chart/KPI mismatch", {
      query: "get_revenue_by_period vs get_kpi_summary",
      restaurantId,
      granularity,
      chartBucket: chartGranularity,
      periodOffset,
      startDate: startIso,
      endDate: endIso,
      kpiTotalRevenue: totalRevenue,
      chartBucketSum: chartSum,
      delta: chartSum - totalRevenue,
    });
  }

  return {
    kpi: {
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      avg_order_value: avgOrderValue,
      top_item_name,
      top_item_quantity,
      items_sold: itemsSold,
      trends: {
        orders: trendFromValues(totalOrders, prevOrders),
        revenue: trendFromValues(totalRevenue, prevRevenue),
        aov: trendFromValues(avgOrderValue, prevAov),
      },
    },
    revenue,
    previousRevenue,
    topItems,
    leastItems,
    peakHours: ((peakHoursRes.data ?? []) as ReportData["peakHours"]).map((h) => ({
      hour_of_day: Number(h.hour_of_day),
      order_count: Number(h.order_count) || 0,
      revenue: Number(h.revenue) || 0,
    })),
    peakDays,
    paymentSplit: normalizePayment(paymentSplitRes.data ?? []),
    waiterPerformance: normalizeWaiters(waiterPerfRes.data ?? []),
    spikedItems: computeSpikedItems(topItems, prevTopItems),
    meta: {
      startDate: startIso,
      endDate: endIso,
      granularity,
      periodOffset,
    },
  };
}

export async function fetchExportOrders(
  supabase: SupabaseClient,
  restaurantId: string,
  startDate: string,
  endDate: string,
  limit?: number
) {
  let query = supabase
    .from("orders")
    .select("id, created_at, total, payment_method, status, delivered_by, table:table_id(table_number)")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error("[reports] fetchExportOrders failed", { restaurantId, startDate, endDate, error: error.message });
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    created_at: row.created_at,
    table_number: row.table?.table_number ?? null,
    total: Number(row.total),
    payment_method: row.payment_method,
    status: row.status,
    delivered_by: row.delivered_by,
  }));
}
