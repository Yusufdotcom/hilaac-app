import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppDayBounds } from "@/lib/time/app-calendar";
import {
  buildMenuIntelligence,
  type MenuIntelligenceResult,
} from "@/lib/menu/menu-intelligence";
import type { MenuItem } from "@/types/database";

function normalizeSales(rows: unknown[]) {
  return (rows ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      item_name: String(row.item_name ?? "Unknown item"),
      quantity_sold: Number(row.quantity_sold ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });
}

/** Last 30 app-days vs prior 30 for Menu Intelligence sales + margin trend. */
export async function fetchMenuIntelligence(
  supabase: SupabaseClient,
  restaurantId: string,
  menuItems: MenuItem[]
): Promise<MenuIntelligenceResult> {
  const { start: curStart } = getAppDayBounds(-29);
  const { end: curEnd } = getAppDayBounds(0);
  const { start: prevStart } = getAppDayBounds(-59);
  const prevEnd = curStart;

  const [currentRes, previousRes] = await Promise.all([
    supabase.rpc("get_top_items", {
      p_restaurant_id: restaurantId,
      p_start_date: curStart.toISOString(),
      p_end_date: curEnd.toISOString(),
      p_limit: 200,
    }),
    supabase.rpc("get_top_items", {
      p_restaurant_id: restaurantId,
      p_start_date: prevStart.toISOString(),
      p_end_date: prevEnd.toISOString(),
      p_limit: 200,
    }),
  ]);

  if (currentRes.error) {
    console.error("[menu-intelligence] get_top_items failed", currentRes.error.message);
  }
  if (previousRes.error) {
    console.error("[menu-intelligence] get_top_items(prev) failed", previousRes.error.message);
  }

  return buildMenuIntelligence({
    menuItems,
    currentSales: normalizeSales((currentRes.data as unknown[]) ?? []),
    previousSales: normalizeSales((previousRes.data as unknown[]) ?? []),
  });
}
