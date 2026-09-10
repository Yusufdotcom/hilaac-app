import type { Expense, ExpenseCategory } from "@/types/database";

export type PnLWaterfall = {
  revenue: number;
  cogs: number;
  labor: number;
  operating: number;
  estProfit: number;
};

export type PnLMargins = {
  grossMarginPct: number | null;
  netMarginPct: number | null;
  foodCostPct: number | null;
  laborPct: number | null;
};

export type MonthlyExpensePoint = {
  key: string;
  label: string;
  total: number;
};

export type CategoryDelta = {
  category: ExpenseCategory;
  current: number;
  previous: number;
  delta: number;
};

export function pctOf(part: number, whole: number): number {
  if (!(whole > 0)) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

export function marginPct(numerator: number, denominator: number): number | null {
  if (!(denominator > 0)) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function buildWaterfall(args: {
  revenue: number;
  cogs: number;
  labor: number;
  operating: number;
}): PnLWaterfall {
  const revenue = Math.max(0, args.revenue);
  const cogs = Math.max(0, args.cogs);
  const labor = Math.max(0, args.labor);
  const operating = Math.max(0, args.operating);
  return {
    revenue,
    cogs,
    labor,
    operating,
    estProfit: revenue - cogs - labor - operating,
  };
}

export function buildMargins(w: PnLWaterfall): PnLMargins {
  return {
    grossMarginPct: marginPct(w.revenue - w.cogs, w.revenue),
    netMarginPct: marginPct(w.estProfit, w.revenue),
    foodCostPct: marginPct(w.cogs, w.revenue),
    laborPct: marginPct(w.labor, w.revenue),
  };
}

export function expenseDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0 && current <= 0) return 0;
  if (previous <= 0) return 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function biggestCategoryIncrease(
  currentByCat: Partial<Record<ExpenseCategory, number>>,
  previousByCat: Partial<Record<ExpenseCategory, number>>
): CategoryDelta | null {
  const cats: ExpenseCategory[] = ["rent", "utilities", "labor", "supplies", "other"];
  let best: CategoryDelta | null = null;
  for (const category of cats) {
    const current = currentByCat[category] ?? 0;
    const previous = previousByCat[category] ?? 0;
    const delta = current - previous;
    if (delta <= 0) continue;
    if (!best || delta > best.delta) {
      best = { category, current, previous, delta };
    }
  }
  return best;
}

export function sumByCategory(
  rows: Pick<Expense, "category" | "amount">[]
): Partial<Record<ExpenseCategory, number>> {
  const out: Partial<Record<ExpenseCategory, number>> = {};
  for (const row of rows) {
    const cat = row.category as ExpenseCategory;
    out[cat] = (out[cat] ?? 0) + (Number(row.amount) || 0);
  }
  return out;
}

export function operatingFromCategories(
  byCat: Partial<Record<ExpenseCategory, number>>
): number {
  return (
    (byCat.rent ?? 0) +
    (byCat.utilities ?? 0) +
    (byCat.supplies ?? 0) +
    (byCat.other ?? 0)
  );
}
