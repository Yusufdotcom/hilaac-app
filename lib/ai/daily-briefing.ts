import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppDayBounds } from "@/lib/time/app-calendar";
import { enrichInventoryItem } from "@/lib/inventory/inventory-math";
import type { InventoryItem } from "@/types/database";

export type BriefingContext = {
  restaurantName: string;
  window: { start: string; end: string };
  kpi: {
    total_orders: number;
    total_revenue: number;
    avg_order_value: number;
  } | null;
  topItems: { item_name: string; quantity_sold: number; revenue: number }[];
  peakHours: { hour: number; order_count: number; revenue: number }[];
  revenueByDay: { date: string; order_count: number; revenue: number }[];
  waiterPerformance: { waiter_name: string; deliveries: number; revenue: number }[];
  inventoryAlerts: { name: string; status: string; onHand: number; reorderAt: number | null }[];
  notes: string[];
};

function mapKpi(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  return {
    total_orders: Number(row.total_orders ?? 0) || 0,
    total_revenue: Number(row.total_revenue ?? 0) || 0,
    avg_order_value: Number(row.avg_order_value ?? row.average_order_value ?? 0) || 0,
  };
}

/**
 * Build briefing JSON from live RPCs / inventory only — never invent figures.
 */
export async function buildDailyBriefingContext(
  supabase: SupabaseClient,
  restaurantId: string,
  restaurantName: string
): Promise<BriefingContext> {
  const { start, end } = getAppDayBounds(-1);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const notes: string[] = [];

  const [kpiRes, topRes, peakRes, revRes, waiterRes, invRes] = await Promise.all([
    supabase.rpc("get_kpi_summary", {
      p_restaurant_id: restaurantId,
      p_start_date: startIso,
      p_end_date: endIso,
    }),
    supabase.rpc("get_top_items", {
      p_restaurant_id: restaurantId,
      p_start_date: startIso,
      p_end_date: endIso,
      p_limit: 5,
    }),
    supabase.rpc("get_peak_hours", {
      p_restaurant_id: restaurantId,
      p_start_date: startIso,
      p_end_date: endIso,
    }),
    supabase.rpc("get_revenue_by_period", {
      p_restaurant_id: restaurantId,
      p_start_date: getAppDayBounds(-6).start.toISOString(),
      p_end_date: endIso,
      p_granularity: "daily",
    }),
    supabase.rpc("get_waiter_performance", {
      p_restaurant_id: restaurantId,
      p_start_date: startIso,
      p_end_date: endIso,
    }),
    supabase
      .from("inventory_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .limit(200),
  ]);

  if (kpiRes.error) notes.push(`get_kpi_summary unavailable: ${kpiRes.error.message}`);
  if (topRes.error) notes.push(`get_top_items unavailable: ${topRes.error.message}`);
  if (peakRes.error) notes.push(`get_peak_hours unavailable: ${peakRes.error.message}`);
  if (revRes.error) notes.push(`get_revenue_by_period unavailable: ${revRes.error.message}`);
  if (waiterRes.error) notes.push(`get_waiter_performance unavailable: ${waiterRes.error.message}`);
  if (invRes.error) notes.push(`inventory_items unavailable: ${invRes.error.message}`);

  const kpiRow = (Array.isArray(kpiRes.data) ? kpiRes.data[0] : kpiRes.data) as
    | Record<string, unknown>
    | undefined;

  const topItems = ((topRes.data as unknown[]) ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      item_name: String(row.item_name ?? row.name ?? "Unknown"),
      quantity_sold: Number(row.quantity_sold ?? row.quantity ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });

  const peakHours = ((peakRes.data as unknown[]) ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      hour: Number(row.hour ?? row.peak_hour ?? 0) || 0,
      order_count: Number(row.order_count ?? row.orders ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });

  const revenueByDay = ((revRes.data as unknown[]) ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const start = String(row.period_start ?? "");
    return {
      date: start.slice(0, 10),
      order_count: Number(row.order_count ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });

  const waiterPerformance = ((waiterRes.data as unknown[]) ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      waiter_name: String(row.waiter_name ?? row.name ?? "Unknown"),
      deliveries: Number(row.deliveries ?? row.order_count ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });

  const inventoryAlerts = ((invRes.data ?? []) as InventoryItem[])
    .map(enrichInventoryItem)
    .filter((r) => r.status === "reorder" || r.status === "out")
    .slice(0, 10)
    .map((r) => ({
      name: r.name,
      status: r.status,
      onHand: Number(r.current_stock) || 0,
      reorderAt: r.reorder_level != null ? Number(r.reorder_level) : null,
    }));

  if (!kpiRow && !notes.some((n) => n.includes("get_kpi_summary"))) {
    notes.push("No KPI rows for yesterday — say so if asked about sales.");
  }

  return {
    restaurantName,
    window: { start: startIso, end: endIso },
    kpi: mapKpi(kpiRow),
    topItems,
    peakHours,
    revenueByDay,
    waiterPerformance,
    inventoryAlerts,
    notes,
  };
}

export function dailyBriefingSystemPrompt(language: "en" | "so"): string {
  const langLabel = language === "so" ? "Somali" : "English";
  return `You are a business advisor for a Somali restaurant. Write a concise morning briefing
in ${langLabel} (Somali or English based on their profile preference).
Use the data provided — never invent numbers. Be specific and actionable.
Format: 2-3 sentences of narrative, then up to 3 bullet points of things needing attention.
Keep the total under 150 words. Tone: trusted manager, not corporate report.
If a metric is missing or empty, say you do not have that data — do not guess.`;
}
