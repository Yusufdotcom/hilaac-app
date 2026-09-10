import type { SupabaseClient } from "@supabase/supabase-js";
import { getOwnerBranches, getBranchDisplayLabel } from "@/lib/admin/owner-branches";
import { getDateRange, getPreviousDateRange } from "@/lib/reports/timeframes";
import type { ReportGranularity } from "@/lib/reports/types";

export type BranchComparisonRow = {
  restaurantId: string;
  slug: string;
  location: string;
  orders: number;
  revenue: number;
  avgOrder: number;
  topItem: string | null;
  growthPct: number | null;
  isBest: boolean;
};

function mapKpi(row: Record<string, unknown> | undefined) {
  const orders = Number(row?.total_orders ?? 0) || 0;
  const revenue = Number(row?.total_revenue ?? 0) || 0;
  const avg =
    Number(row?.avg_order_value ?? row?.average_order_value ?? 0) ||
    (orders > 0 ? revenue / orders : 0);
  return { orders, revenue, avgOrder: Math.round(avg * 100) / 100 };
}

/**
 * Parallel per-branch KPI snapshot for owner multi-location comparison.
 * Respects RLS by using the caller's supabase client (owner can read own restaurants).
 */
export async function fetchBranchComparison(
  supabase: SupabaseClient,
  ownerId: string,
  granularity: ReportGranularity = "monthly"
): Promise<BranchComparisonRow[]> {
  const branches = await getOwnerBranches(supabase, ownerId);
  if (branches.length === 0) return [];

  const { start, end } = getDateRange(granularity, 0);
  const prev = getPreviousDateRange(granularity, 0);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const prevStart = prev.start.toISOString();
  const prevEnd = prev.end.toISOString();

  const rows = await Promise.all(
    branches.map(async (b) => {
      const [kpiRes, prevRes, topRes] = await Promise.all([
        supabase.rpc("get_kpi_summary", {
          p_restaurant_id: b.id,
          p_start_date: startIso,
          p_end_date: endIso,
        }),
        supabase.rpc("get_kpi_summary", {
          p_restaurant_id: b.id,
          p_start_date: prevStart,
          p_end_date: prevEnd,
        }),
        supabase.rpc("get_top_items", {
          p_restaurant_id: b.id,
          p_start_date: startIso,
          p_end_date: endIso,
          p_limit: 1,
        }),
      ]);

      if (kpiRes.error) {
        console.error("[locations] get_kpi_summary", b.slug, kpiRes.error.message);
      }

      const kpi = mapKpi(
        (Array.isArray(kpiRes.data) ? kpiRes.data[0] : kpiRes.data) as
          | Record<string, unknown>
          | undefined
      );
      const prevKpi = mapKpi(
        (Array.isArray(prevRes.data) ? prevRes.data[0] : prevRes.data) as
          | Record<string, unknown>
          | undefined
      );

      let growthPct: number | null = null;
      if (prevKpi.revenue > 0) {
        growthPct = Math.round(((kpi.revenue - prevKpi.revenue) / prevKpi.revenue) * 1000) / 10;
      } else if (kpi.revenue > 0) {
        growthPct = 100;
      }

      const topRaw = Array.isArray(topRes.data) ? topRes.data[0] : null;
      const topItem =
        topRaw && typeof topRaw === "object"
          ? String((topRaw as Record<string, unknown>).item_name ?? "—")
          : null;

      return {
        restaurantId: b.id,
        slug: b.slug,
        location: getBranchDisplayLabel(b),
        orders: kpi.orders,
        revenue: kpi.revenue,
        avgOrder: kpi.avgOrder,
        topItem,
        growthPct,
        isBest: false,
      } satisfies BranchComparisonRow;
    })
  );

  const bestRevenue = Math.max(0, ...rows.map((r) => r.revenue));
  return rows
    .map((r) => ({
      ...r,
      isBest: bestRevenue > 0 && r.revenue === bestRevenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
