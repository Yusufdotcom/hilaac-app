import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_TIMEZONE, getAppMonthBounds } from "@/lib/time/app-calendar";
import type { Expense, ExpenseCategory } from "@/types/database";
import {
  biggestCategoryIncrease,
  buildMargins,
  buildWaterfall,
  expenseDeltaPct,
  operatingFromCategories,
  sumByCategory,
  type MonthlyExpensePoint,
  type PnLMargins,
  type PnLWaterfall,
} from "@/lib/expenses/pnl-math";

export type ExpensesPageData = {
  expenses: Expense[];
  monthExpenseTotal: number;
  prevMonthExpenseTotal: number;
  expenseDeltaPct: number | null;
  waterfall: PnLWaterfall;
  margins: PnLMargins;
  insightCategory: ExpenseCategory | null;
  monthlySeries: MonthlyExpensePoint[];
};

async function revenueForRange(
  supabase: SupabaseClient,
  restaurantId: string,
  start: Date,
  end: Date
): Promise<number> {
  const { data, error } = await supabase.rpc("get_kpi_summary", {
    p_restaurant_id: restaurantId,
    p_start_date: start.toISOString(),
    p_end_date: end.toISOString(),
  });
  if (error) {
    console.error("[expenses] get_kpi_summary failed", error.message);
    return 0;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return Number((row as Record<string, unknown> | undefined)?.total_revenue ?? 0) || 0;
}

/** COGS ≈ sum(qty × cost_price) for paid order items in range. */
async function cogsForRange(
  supabase: SupabaseClient,
  restaurantId: string,
  start: Date,
  end: Date
): Promise<number> {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("payment_status", "paid")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error || !orders?.length) {
    if (error) console.error("[expenses] orders for cogs failed", error.message);
    return 0;
  }

  const orderIds = orders.map((o) => o.id);
  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("quantity, menu_item_id, menu_item:menu_item_id(cost_price)")
    .in("order_id", orderIds);

  if (itemsErr) {
    console.error("[expenses] order_items cogs failed", itemsErr.message);
    return 0;
  }

  let total = 0;
  for (const raw of items ?? []) {
    const row = raw as {
      quantity: number;
      menu_item?: { cost_price: number | null } | { cost_price: number | null }[] | null;
    };
    const mi = Array.isArray(row.menu_item) ? row.menu_item[0] : row.menu_item;
    const cost = mi?.cost_price != null ? Number(mi.cost_price) : null;
    if (cost == null || Number.isNaN(cost)) continue;
    total += (Number(row.quantity) || 0) * cost;
  }
  return total;
}

function monthMeta(offset: number, now = new Date()) {
  const { start, end } = getAppMonthBounds(offset, now);
  const label = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(start);
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  // Prefer APP calendar month from start instant in APP_TIMEZONE
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(start);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return {
    key: y && m ? `${y}-${m}` : key,
    label,
    start,
    end,
    dateStart: start.toISOString().slice(0, 10),
    dateEnd: end.toISOString().slice(0, 10),
  };
}

export async function fetchExpensesPageData(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<ExpensesPageData> {
  const thisMonth = monthMeta(0);
  const prevMonth = monthMeta(-1);
  const seriesMeta = [5, 4, 3, 2, 1, 0].map((o) => monthMeta(-o));
  const seriesStart = seriesMeta[0]!.dateStart;
  const seriesEnd = thisMonth.dateEnd;

  const [revenue, cogs, monthExpensesRes, prevExpensesRes, seriesRes] = await Promise.all([
    revenueForRange(supabase, restaurantId, thisMonth.start, thisMonth.end),
    cogsForRange(supabase, restaurantId, thisMonth.start, thisMonth.end),
    supabase
      .from("expenses")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .gte("date", thisMonth.dateStart)
      .lt("date", thisMonth.dateEnd)
      .order("date", { ascending: false }),
    supabase
      .from("expenses")
      .select("category, amount")
      .eq("restaurant_id", restaurantId)
      .gte("date", prevMonth.dateStart)
      .lt("date", prevMonth.dateEnd),
    supabase
      .from("expenses")
      .select("amount, date, category")
      .eq("restaurant_id", restaurantId)
      .gte("date", seriesStart)
      .lt("date", seriesEnd),
  ]);

  if (monthExpensesRes.error) {
    console.error("[expenses] month list failed", monthExpensesRes.error.message);
  }

  const expenses = (monthExpensesRes.data ?? []) as Expense[];
  const prevRows = (prevExpensesRes.data ?? []) as Pick<Expense, "category" | "amount">[];
  const seriesRows = (seriesRes.data ?? []) as Pick<Expense, "amount" | "date" | "category">[];

  const byCat = sumByCategory(expenses);
  const prevByCat = sumByCategory(prevRows);
  const labor = byCat.labor ?? 0;
  const operating = operatingFromCategories(byCat);
  const waterfall = buildWaterfall({ revenue, cogs, labor, operating });
  const margins = buildMargins(waterfall);

  const monthExpenseTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const prevMonthExpenseTotal = prevRows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const insight = biggestCategoryIncrease(byCat, prevByCat);

  const monthlySeries: MonthlyExpensePoint[] = seriesMeta.map((m) => {
    const total = seriesRows
      .filter((r) => r.date >= m.dateStart && r.date < m.dateEnd)
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return { key: m.key, label: m.label, total };
  });

  return {
    expenses,
    monthExpenseTotal,
    prevMonthExpenseTotal,
    expenseDeltaPct: expenseDeltaPct(monthExpenseTotal, prevMonthExpenseTotal),
    waterfall,
    margins,
    insightCategory: insight?.category ?? null,
    monthlySeries,
  };
}
