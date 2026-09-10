import type { InventoryItem } from "@/types/database";

export type InventoryStatus = "good" | "reorder" | "out";

export type InventoryRow = InventoryItem & {
  dailyUsage: number;
  daysRemaining: number | null;
  status: InventoryStatus;
  recommendedOrder: number;
  lineValue: number;
  isSlowMoving: boolean;
};

export function inventoryStatus(item: {
  current_stock: number;
  reorder_level: number | null;
}): InventoryStatus {
  const stock = Number(item.current_stock) || 0;
  if (stock <= 0) return "out";
  const reorder = item.reorder_level != null ? Number(item.reorder_level) : null;
  if (reorder != null && stock <= reorder) return "reorder";
  return "good";
}

/** days_remaining = current_stock / NULLIF(daily_usage_estimate, 0) */
export function daysRemaining(
  currentStock: number,
  dailyUsage: number | null | undefined
): number | null {
  const usage = Number(dailyUsage) || 0;
  if (usage <= 0) return null;
  return Math.round(((Number(currentStock) || 0) / usage) * 10) / 10;
}

/**
 * Recommended order qty:
 * (daily_usage × delivery_days) + reorder_level - current_stock
 */
export function recommendedOrderQty(item: {
  current_stock: number;
  daily_usage_estimate: number | null;
  reorder_level: number | null;
  supplier_delivery_days: number;
}): number {
  const usage = Number(item.daily_usage_estimate) || 0;
  const delivery = Math.max(0, Number(item.supplier_delivery_days) || 0);
  const reorder = Number(item.reorder_level) || 0;
  const stock = Number(item.current_stock) || 0;
  return Math.max(0, Math.ceil(usage * delivery + reorder - stock));
}

export function enrichInventoryItem(item: InventoryItem): InventoryRow {
  const dailyUsage = Number(item.daily_usage_estimate) || 0;
  const stock = Number(item.current_stock) || 0;
  const cost = Number(item.cost_per_unit) || 0;
  const days = daysRemaining(stock, item.daily_usage_estimate);
  const status = inventoryStatus(item);
  const isSlowMoving =
    stock > 0 && (dailyUsage <= 0 || (days != null && days > 45));

  return {
    ...item,
    dailyUsage,
    daysRemaining: days,
    status,
    recommendedOrder: recommendedOrderQty(item),
    lineValue: stock * cost,
    isSlowMoving,
  };
}

export function inventoryKpis(rows: InventoryRow[]) {
  return {
    totalValue: rows.reduce((s, r) => s + r.lineValue, 0),
    lowStock: rows.filter((r) => r.status === "reorder").length,
    outOfStock: rows.filter((r) => r.status === "out").length,
    slowMoving: rows.filter((r) => r.isSlowMoving).length,
  };
}

export type WasteEntry = {
  id: string;
  productName: string;
  amount: number;
  lossUsd: number;
  date: string;
  note: string | null;
};

/** Parse waste logs stored as expenses (category supplies/other) with note prefix. */
export const WASTE_NOTE_PREFIX = "Waste:";

export function parseWasteFromExpense(row: {
  id: string;
  amount: number;
  date: string;
  note: string | null;
}): WasteEntry | null {
  const note = row.note?.trim() ?? "";
  if (!note.toLowerCase().startsWith("waste:")) return null;
  const productName = note.slice(WASTE_NOTE_PREFIX.length).trim() || "Unknown";
  return {
    id: row.id,
    productName,
    amount: Number(row.amount) || 0,
    lossUsd: Number(row.amount) || 0,
    date: row.date,
    note,
  };
}
