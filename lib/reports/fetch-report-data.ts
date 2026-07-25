import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ItemStat,
  KpiTrend,
  ReportData,
  ReportGranularity,
  SpikedItem,
} from "@/lib/reports/types";
import { getDateRange, getPreviousDateRange } from "@/lib/reports/timeframes";

function mapRpcError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function trendFromValues(current: number, previous: number): KpiTrend {
  if (previous <= 0 && current <= 0) {
    return { percent: 0, direction: "flat" };
  }
  if (previous <= 0) {
    return { percent: 100, direction: "up" };
  }
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.5) return { percent: 0, direction: "flat" };
  return {
    percent: Math.round(percent * 10) / 10,
    direction: percent > 0 ? "up" : "down",
  };
}

function computeSpikedItems(current: ItemStat[], previous: ItemStat[]): SpikedItem[] {
  const prevMap = new Map(previous.map((i) => [i.item_name, Number(i.quantity_sold)]));

  const spikes: SpikedItem[] = current
    .map((item) => {
      const qty = Number(item.quantity_sold);
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

  return spikes;
}

export async function fetchReportData(
  supabase: SupabaseClient,
  restaurantId: string,
  granularity: ReportGranularity
): Promise<ReportData> {
  const { start, end } = getDateRange(granularity);
  const prev = getPreviousDateRange(granularity);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const prevStartIso = prev.start.toISOString();
  const prevEndIso = prev.end.toISOString();

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

  const [
    kpiRes,
    prevKpiRes,
    revenueRes,
    topItemsRes,
    prevTopItemsRes,
    leastItemsRes,
    peakHoursRes,
    paymentSplitRes,
    waiterPerfRes,
  ] = await Promise.all([
    supabase.rpc("get_kpi_summary", rpcBase),
    supabase.rpc("get_kpi_summary", prevRpcBase),
    supabase.rpc("get_revenue_by_period", { ...rpcBase, p_granularity: granularity }),
    supabase.rpc("get_top_items", { ...rpcBase, p_limit: 10 }),
    supabase.rpc("get_top_items", { ...prevRpcBase, p_limit: 25 }),
    supabase.rpc("get_least_ordered_items", { ...rpcBase, p_limit: 5 }),
    supabase.rpc("get_peak_hours", rpcBase),
    supabase.rpc("get_payment_split", rpcBase),
    supabase.rpc("get_waiter_performance", rpcBase),
  ]);

  mapRpcError("KPI summary", kpiRes.error);
  mapRpcError("Previous KPI summary", prevKpiRes.error);
  mapRpcError("Revenue", revenueRes.error);
  mapRpcError("Top items", topItemsRes.error);
  mapRpcError("Previous top items", prevTopItemsRes.error);
  mapRpcError("Least ordered items", leastItemsRes.error);
  mapRpcError("Peak hours", peakHoursRes.error);
  mapRpcError("Payment split", paymentSplitRes.error);
  mapRpcError("Waiter performance", waiterPerfRes.error);

  const kpiRow = (kpiRes.data?.[0] ?? {}) as Record<string, unknown>;
  const prevKpiRow = (prevKpiRes.data?.[0] ?? {}) as Record<string, unknown>;

  const totalOrders = Number(kpiRow.total_orders ?? 0);
  const totalRevenue = Number(kpiRow.total_revenue ?? 0);
  const avgOrderValue = Number(kpiRow.avg_order_value ?? 0);

  const prevOrders = Number(prevKpiRow.total_orders ?? 0);
  const prevRevenue = Number(prevKpiRow.total_revenue ?? 0);
  const prevAov = Number(prevKpiRow.avg_order_value ?? 0);

  const topItems = (topItemsRes.data ?? []) as ItemStat[];
  const prevTopItems = (prevTopItemsRes.data ?? []) as ItemStat[];

  return {
    kpi: {
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      avg_order_value: avgOrderValue,
      top_item_name: String(kpiRow.top_item_name ?? "—"),
      top_item_quantity: Number(kpiRow.top_item_quantity ?? 0),
      trends: {
        orders: trendFromValues(totalOrders, prevOrders),
        revenue: trendFromValues(totalRevenue, prevRevenue),
        aov: trendFromValues(avgOrderValue, prevAov),
      },
    },
    revenue: (revenueRes.data ?? []) as ReportData["revenue"],
    topItems,
    leastItems: (leastItemsRes.data ?? []) as ReportData["leastItems"],
    peakHours: (peakHoursRes.data ?? []) as ReportData["peakHours"],
    paymentSplit: (paymentSplitRes.data ?? []) as ReportData["paymentSplit"],
    waiterPerformance: (waiterPerfRes.data ?? []) as ReportData["waiterPerformance"],
    spikedItems: computeSpikedItems(topItems, prevTopItems),
    meta: {
      startDate: startIso,
      endDate: endIso,
      granularity,
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
  if (error) throw new Error(error.message);

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
