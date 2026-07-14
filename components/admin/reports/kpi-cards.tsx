import { formatCurrency } from "@/lib/utils";
import type { KpiSummary } from "@/lib/reports/types";

export function KpiCards({ kpi }: { kpi: KpiSummary }) {
  const cards = [
    { label: "Total Orders", value: kpi.total_orders.toLocaleString() },
    { label: "Total Revenue", value: formatCurrency(kpi.total_revenue) },
    { label: "Average Order Value", value: formatCurrency(kpi.avg_order_value) },
    {
      label: "Top Selling Item",
      value: kpi.top_item_name,
      sub: kpi.top_item_quantity > 0 ? `${kpi.top_item_quantity} sold` : undefined,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-[#64748B]">{card.label}</p>
          <p className="mt-2 text-2xl font-bold text-[#0F172A]">{card.value}</p>
          {card.sub && <p className="mt-1 text-xs text-[#94A3B8]">{card.sub}</p>}
        </article>
      ))}
    </div>
  );
}
