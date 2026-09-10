import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enrichInventoryItem,
  inventoryKpis,
  parseWasteFromExpense,
  type InventoryRow,
  type WasteEntry,
} from "@/lib/inventory/inventory-math";
import type { InventoryItem } from "@/types/database";
import { getAppMonthBounds } from "@/lib/time/app-calendar";

export type InventoryPageData = {
  rows: InventoryRow[];
  kpis: ReturnType<typeof inventoryKpis>;
  actionRows: InventoryRow[];
  wasteThisMonth: WasteEntry[];
  wastePrevMonth: WasteEntry[];
  monthlyWasteTotal: number;
  wasteTrendingUp: boolean;
};

export async function fetchInventoryPageData(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<InventoryPageData> {
  const { start: monthStart, end: monthEnd } = getAppMonthBounds(0);
  const { start: prevStart, end: prevEnd } = getAppMonthBounds(-1);

  const [invRes, wasteRes, prevWasteRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name"),
    supabase
      .from("expenses")
      .select("id, amount, date, note, category")
      .eq("restaurant_id", restaurantId)
      .gte("date", monthStart.toISOString().slice(0, 10))
      .lt("date", monthEnd.toISOString().slice(0, 10))
      .in("category", ["supplies", "other"])
      .order("date", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, amount, date, note, category")
      .eq("restaurant_id", restaurantId)
      .gte("date", prevStart.toISOString().slice(0, 10))
      .lt("date", prevEnd.toISOString().slice(0, 10))
      .in("category", ["supplies", "other"]),
  ]);

  if (invRes.error) {
    console.error("[inventory] load failed", invRes.error.message);
  }

  const rows = ((invRes.data ?? []) as InventoryItem[]).map(enrichInventoryItem);
  const kpis = inventoryKpis(rows);
  const actionRows = rows.filter((r) => r.status === "reorder" || r.status === "out");

  const wasteThisMonth = ((wasteRes.data ?? []) as {
    id: string;
    amount: number;
    date: string;
    note: string | null;
  }[])
    .map(parseWasteFromExpense)
    .filter((w): w is WasteEntry => w != null);

  const wastePrevMonth = ((prevWasteRes.data ?? []) as {
    id: string;
    amount: number;
    date: string;
    note: string | null;
  }[])
    .map(parseWasteFromExpense)
    .filter((w): w is WasteEntry => w != null);

  const monthlyWasteTotal = wasteThisMonth.reduce((s, w) => s + w.lossUsd, 0);
  const prevTotal = wastePrevMonth.reduce((s, w) => s + w.lossUsd, 0);
  const wasteTrendingUp = prevTotal > 0 && monthlyWasteTotal > prevTotal * 1.1;

  return {
    rows,
    kpis,
    actionRows,
    wasteThisMonth,
    wastePrevMonth,
    monthlyWasteTotal,
    wasteTrendingUp,
  };
}
