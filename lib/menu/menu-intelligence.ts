export type MenuClass = "stars" | "sellers" | "high_profit" | "slow";

export type MenuIntelligenceItem = {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
  costTotal: number;
  estProfit: number;
  marginPct: number;
  classification: MenuClass;
  /** Margin trend vs prior period: up | down | flat */
  marginTrend: "up" | "down" | "flat";
};

export type MenuIntelligenceSummary = {
  mostOrdered: { name: string; units: number } | null;
  mostProfitable: { name: string; profit: number; marginPct: number } | null;
  leastProfitable: { name: string; marginPct: number } | null;
};

export type MenuIntelligenceResult = {
  items: MenuIntelligenceItem[];
  counts: Record<MenuClass, number>;
  summary: MenuIntelligenceSummary;
  hasCostPrices: boolean;
};

const CLASS_ORDER: Record<MenuClass, number> = {
  stars: 0,
  sellers: 1,
  high_profit: 2,
  slow: 3,
};

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function classifyMenuItem(args: {
  unitsSold: number;
  marginPct: number;
  salesMedian: number;
}): MenuClass {
  const highSales = args.unitsSold > args.salesMedian;
  const highProfit = args.marginPct > 40;
  if (highSales && highProfit) return "stars";
  if (highSales && !highProfit) return "sellers";
  if (!highSales && highProfit) return "high_profit";
  return "slow";
}

export function marginTrendFrom(
  currentMargin: number,
  previousMargin: number | null
): "up" | "down" | "flat" {
  if (previousMargin == null || Number.isNaN(previousMargin)) return "flat";
  const delta = currentMargin - previousMargin;
  if (Math.abs(delta) < 0.5) return "flat";
  return delta > 0 ? "up" : "down";
}

type SalesRow = { item_name: string; quantity_sold: number; revenue: number };

/**
 * Build Menu Intelligence rows for items that have cost_price set.
 * Sales maps are keyed by menu item name (matches get_top_items).
 */
export function buildMenuIntelligence(args: {
  menuItems: {
    id: string;
    name: string;
    price: number;
    cost_price?: number | null;
  }[];
  currentSales: SalesRow[];
  previousSales: SalesRow[];
}): MenuIntelligenceResult {
  const withCost = args.menuItems.filter(
    (m) => m.cost_price != null && Number.isFinite(Number(m.cost_price))
  );

  if (withCost.length === 0) {
    return {
      items: [],
      counts: { stars: 0, sellers: 0, high_profit: 0, slow: 0 },
      summary: { mostOrdered: null, mostProfitable: null, leastProfitable: null },
      hasCostPrices: false,
    };
  }

  const currentMap = new Map(
    args.currentSales.map((r) => [
      r.item_name,
      { qty: Number(r.quantity_sold) || 0, revenue: Number(r.revenue) || 0 },
    ])
  );
  const prevMap = new Map(
    args.previousSales.map((r) => [
      r.item_name,
      { qty: Number(r.quantity_sold) || 0, revenue: Number(r.revenue) || 0 },
    ])
  );

  const unitsList = withCost.map((m) => currentMap.get(m.name)?.qty ?? 0);
  const salesMedian = median(unitsList);

  const items: MenuIntelligenceItem[] = withCost.map((m) => {
    const cur = currentMap.get(m.name) ?? { qty: 0, revenue: 0 };
    const prev = prevMap.get(m.name);
    const costUnit = Number(m.cost_price);
    const price = Number(m.price) || 0;
    const costTotal = costUnit * cur.qty;
    const estProfit = cur.revenue - costTotal;
    const marginPct =
      cur.revenue > 0
        ? ((cur.revenue - costTotal) / cur.revenue) * 100
        : price > 0
          ? ((price - costUnit) / price) * 100
          : 0;

    let prevMargin: number | null = null;
    if (prev && prev.revenue > 0) {
      const prevCost = costUnit * prev.qty;
      prevMargin = ((prev.revenue - prevCost) / prev.revenue) * 100;
    }

    return {
      id: m.id,
      name: m.name,
      unitsSold: cur.qty,
      revenue: cur.revenue,
      costTotal,
      estProfit,
      marginPct,
      classification: classifyMenuItem({
        unitsSold: cur.qty,
        marginPct,
        salesMedian,
      }),
      marginTrend: marginTrendFrom(marginPct, prevMargin),
    };
  });

  items.sort((a, b) => {
    const c = CLASS_ORDER[a.classification] - CLASS_ORDER[b.classification];
    if (c !== 0) return c;
    return b.estProfit - a.estProfit;
  });

  const counts: Record<MenuClass, number> = {
    stars: 0,
    sellers: 0,
    high_profit: 0,
    slow: 0,
  };
  for (const item of items) counts[item.classification] += 1;

  const mostOrdered = [...items].sort((a, b) => b.unitsSold - a.unitsSold)[0] ?? null;
  const mostProfitable =
    [...items].sort((a, b) => b.estProfit - a.estProfit)[0] ?? null;
  const leastProfitable =
    [...items].sort((a, b) => a.marginPct - b.marginPct)[0] ?? null;

  return {
    items,
    counts,
    summary: {
      mostOrdered: mostOrdered
        ? { name: mostOrdered.name, units: mostOrdered.unitsSold }
        : null,
      mostProfitable: mostProfitable
        ? {
            name: mostProfitable.name,
            profit: mostProfitable.estProfit,
            marginPct: mostProfitable.marginPct,
          }
        : null,
      leastProfitable: leastProfitable
        ? { name: leastProfitable.name, marginPct: leastProfitable.marginPct }
        : null,
    },
    hasCostPrices: true,
  };
}
