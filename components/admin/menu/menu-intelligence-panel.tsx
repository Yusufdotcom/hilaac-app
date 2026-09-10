import { Sparkles } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  MenuClass,
  MenuIntelligenceItem,
  MenuIntelligenceResult,
} from "@/lib/menu/menu-intelligence";

const CLASS_META: Record<
  MenuClass,
  { label: string; blurb: string; dot: string; badge: string }
> = {
  stars: {
    label: "Stars",
    blurb: "High sales + high profit",
    dot: "bg-emerald-800",
    badge: "bg-emerald-800 text-white",
  },
  sellers: {
    label: "Sellers",
    blurb: "High sales + low profit",
    dot: "bg-teal-500",
    badge: "bg-teal-500 text-white",
  },
  high_profit: {
    label: "High Profit",
    blurb: "Low sales + high profit",
    dot: "bg-lime-500",
    badge: "bg-lime-500 text-lime-950",
  },
  slow: {
    label: "Slow",
    blurb: "Low sales + low profit",
    dot: "bg-slate-400",
    badge: "bg-slate-400 text-slate-900",
  },
};

function TrendArrow({ trend }: { trend: MenuIntelligenceItem["marginTrend"] }) {
  if (trend === "up") return <span className="text-emerald-600">↗</span>;
  if (trend === "down") return <span className="text-red-600">↘</span>;
  return <span className="text-[var(--admin-muted,#94A3B8)]">—</span>;
}

export function MenuIntelligencePanel({
  data,
  gated,
}: {
  data: MenuIntelligenceResult | null;
  /** True when tier lacks menu_profitability */
  gated?: boolean;
}) {
  if (gated) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
          Menu Intelligence is on Gorgor 1.0 and above
        </p>
        <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
          Upgrade to unlock profitability classifications and margin trends.
        </p>
      </div>
    );
  }

  if (!data || !data.hasCostPrices) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center dark:border-amber-900/40 dark:bg-amber-950/30">
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
          Add cost prices to unlock Menu Intelligence
        </p>
        <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
          Edit a menu item and set its cost price. Once at least one item has a cost, classifications
          and profit estimates appear here.
        </p>
      </div>
    );
  }

  const classes: MenuClass[] = ["stars", "sellers", "high_profit", "slow"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {classes.map((key) => {
          const meta = CLASS_META[key];
          return (
            <div
              key={key}
              className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4"
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} aria-hidden="true" />
                <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
                  {meta.label}
                </p>
                <span className="ml-auto text-lg font-bold tabular-nums text-[var(--admin-text,#0F172A)]">
                  {data.counts[key]}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--admin-muted,#64748B)]">{meta.blurb}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.items.map((item) => {
          const meta = CLASS_META[item.classification];
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--admin-text,#0F172A)]">
                  {item.name}
                </h3>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    meta.badge
                  )}
                >
                  {meta.label}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[var(--admin-muted,#64748B)]">Units sold</p>
                  <p className="font-semibold tabular-nums text-[var(--admin-text,#0F172A)]">
                    {item.unitsSold}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--admin-muted,#64748B)]">Revenue</p>
                  <p className="font-semibold tabular-nums text-[var(--admin-text,#0F172A)]">
                    {formatCurrency(item.revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--admin-muted,#64748B)]">Cost</p>
                  <p className="font-semibold tabular-nums text-[var(--admin-text,#0F172A)]">
                    {formatCurrency(item.costTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--admin-muted,#64748B)]">Est. Profit</p>
                  <p className="font-bold tabular-nums text-emerald-600">
                    {formatCurrency(item.estProfit)}
                  </p>
                </div>
              </div>

              <p className="mt-4 flex items-center gap-1.5 text-xs text-[var(--admin-muted,#64748B)]">
                <span className="font-semibold text-[var(--admin-text,#0F172A)]">
                  {Math.round(item.marginPct)}% margin
                </span>
                <TrendArrow trend={item.marginTrend} />
              </p>
            </article>
          );
        })}
      </div>

      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 p-5 text-white sm:p-6"
        style={{
          background: "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <Sparkles className="h-4 w-4 text-[#D4A373]" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold">Menu Intelligence</p>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-white/80">
          <li>
            Most ordered:{" "}
            <span className="font-semibold text-white">
              {data.summary.mostOrdered
                ? `${data.summary.mostOrdered.name} (${data.summary.mostOrdered.units} units)`
                : "—"}
            </span>
          </li>
          <li>
            Most profitable:{" "}
            <span className="font-semibold text-white">
              {data.summary.mostProfitable
                ? `${data.summary.mostProfitable.name} (${formatCurrency(data.summary.mostProfitable.profit)} · ${Math.round(data.summary.mostProfitable.marginPct)}% margin)`
                : "—"}
            </span>
          </li>
          <li>
            Least profitable:{" "}
            <span className="font-semibold text-white">
              {data.summary.leastProfitable
                ? `${data.summary.leastProfitable.name} (${Math.round(data.summary.leastProfitable.marginPct)}% margin)`
                : "—"}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
