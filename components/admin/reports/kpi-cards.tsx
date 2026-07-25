import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { KpiSummary, KpiTrend } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

function TrendBadge({ trend }: { trend: KpiTrend }) {
  if (trend.direction === "flat" || trend.percent == null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
        <Minus className="h-3 w-3" aria-hidden="true" />
        0%
      </span>
    );
  }

  const up = trend.direction === "up";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold",
        up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
      )}
    >
      {up ? (
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {Math.abs(trend.percent)}%
    </span>
  );
}

export function KpiCards({ kpi }: { kpi: KpiSummary }) {
  const trends = kpi.trends ?? {
    orders: { percent: 0, direction: "flat" as const },
    revenue: { percent: 0, direction: "flat" as const },
    aov: { percent: 0, direction: "flat" as const },
  };

  const cards = [
    {
      label: "Total Orders",
      value: kpi.total_orders.toLocaleString(),
      trend: trends.orders,
    },
    {
      label: "Total Revenue",
      value: formatCurrency(kpi.total_revenue),
      trend: trends.revenue,
    },
    {
      label: "Avg Order Value",
      value: formatCurrency(kpi.avg_order_value),
      trend: trends.aov,
    },
    {
      label: "Top Selling Item",
      value: kpi.top_item_name,
      sub: kpi.top_item_quantity > 0 ? `${kpi.top_item_quantity} sold` : "No sales yet",
      trend: null as KpiTrend | null,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-[#64748B]">{card.label}</p>
            {card.trend && <TrendBadge trend={card.trend} />}
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[#0F172A]">{card.value}</p>
          {card.sub && <p className="mt-1.5 text-xs font-medium text-[#94A3B8]">{card.sub}</p>}
          {card.trend && (
            <p className="mt-2 text-[11px] text-[#94A3B8]">vs previous period</p>
          )}
        </article>
      ))}
    </div>
  );
}
