import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportData, ReportGranularity } from "@/lib/reports/types";
import { getDateRange } from "@/lib/reports/timeframes";

function mapRpcError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function fetchReportData(
  supabase: SupabaseClient,
  restaurantId: string,
  granularity: ReportGranularity
): Promise<ReportData> {
  const { start, end } = getDateRange(granularity);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const rpcBase = {
    p_restaurant_id: restaurantId,
    p_start_date: startIso,
    p_end_date: endIso,
  };

  const [
    kpiRes,
    revenueRes,
    topItemsRes,
    leastItemsRes,
    peakHoursRes,
    paymentSplitRes,
    waiterPerfRes,
  ] = await Promise.all([
    supabase.rpc("get_kpi_summary", rpcBase),
    supabase.rpc("get_revenue_by_period", { ...rpcBase, p_granularity: granularity }),
    supabase.rpc("get_top_items", { ...rpcBase, p_limit: 10 }),
    supabase.rpc("get_least_ordered_items", { ...rpcBase, p_limit: 5 }),
    supabase.rpc("get_peak_hours", rpcBase),
    supabase.rpc("get_payment_split", rpcBase),
    supabase.rpc("get_waiter_performance", rpcBase),
  ]);

  mapRpcError("KPI summary", kpiRes.error);
  mapRpcError("Revenue", revenueRes.error);
  mapRpcError("Top items", topItemsRes.error);
  mapRpcError("Least ordered items", leastItemsRes.error);
  mapRpcError("Peak hours", peakHoursRes.error);
  mapRpcError("Payment split", paymentSplitRes.error);
  mapRpcError("Waiter performance", waiterPerfRes.error);

  const kpiRow = (kpiRes.data?.[0] ?? {}) as Record<string, unknown>;

  return {
    kpi: {
      total_orders: Number(kpiRow.total_orders ?? 0),
      total_revenue: Number(kpiRow.total_revenue ?? 0),
      avg_order_value: Number(kpiRow.avg_order_value ?? 0),
      top_item_name: String(kpiRow.top_item_name ?? "—"),
      top_item_quantity: Number(kpiRow.top_item_quantity ?? 0),
    },
    revenue: (revenueRes.data ?? []) as ReportData["revenue"],
    topItems: (topItemsRes.data ?? []) as ReportData["topItems"],
    leastItems: (leastItemsRes.data ?? []) as ReportData["leastItems"],
    peakHours: (peakHoursRes.data ?? []) as ReportData["peakHours"],
    paymentSplit: (paymentSplitRes.data ?? []) as ReportData["paymentSplit"],
    waiterPerformance: (waiterPerfRes.data ?? []) as ReportData["waiterPerformance"],
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
