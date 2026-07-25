"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { KpiSummary, KpiTrend } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useCountUp(target: number, enabled: boolean, durationMs = 700) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!enabled || reduced) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, reduced, durationMs]);

  return value;
}

function TrendBadge({ trend }: { trend: KpiTrend }) {
  if (trend.direction === "flat" || trend.percent == null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
        <Minus className="h-3 w-3" aria-hidden="true" />
        <span>0%</span>
      </span>
    );
  }

  const up = trend.direction === "up";
  const sign = up ? "+" : "−";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold",
        up ? "bg-emerald-50 text-[#10B981]" : "bg-red-50 text-[#EF4444]"
      )}
      style={up ? { color: "#10B981" } : { color: "#EF4444" }}
    >
      {up ? (
        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>
        {sign}
        {Math.abs(trend.percent)}%
      </span>
    </span>
  );
}

function ComparisonTooltip({
  label,
  trend,
  format,
}: {
  label: string;
  trend: KpiTrend;
  format: (n: number) => string;
}) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
    >
      {format(trend.current)} vs {format(trend.previous)} last period
      <span className="sr-only">
        {label}: {format(trend.current)} versus {format(trend.previous)} last period
      </span>
    </span>
  );
}

type KpiCardsProps = {
  kpi: KpiSummary;
  /** Animate numbers only on the very first paint of the page. */
  animateEntrance?: boolean;
  onEntranceComplete?: () => void;
};

export function KpiCards({
  kpi,
  animateEntrance = false,
  onEntranceComplete,
}: KpiCardsProps) {
  const animatedOnce = useRef(false);
  const shouldAnimate = animateEntrance && !animatedOnce.current;

  useEffect(() => {
    if (!animateEntrance || animatedOnce.current) return;
    animatedOnce.current = true;
    const t = window.setTimeout(() => onEntranceComplete?.(), 750);
    return () => window.clearTimeout(t);
  }, [animateEntrance, onEntranceComplete]);

  const trends = kpi.trends;
  const ordersDisplay = useCountUp(kpi.total_orders, shouldAnimate);
  const revenueDisplay = useCountUp(kpi.total_revenue, shouldAnimate);
  const aovDisplay = useCountUp(kpi.avg_order_value, shouldAnimate);

  const cards = [
    {
      label: "Total Orders",
      value: Math.round(ordersDisplay).toLocaleString(),
      trend: trends.orders,
      format: (n: number) => Math.round(n).toLocaleString(),
    },
    {
      label: "Total Revenue",
      value: formatCurrency(revenueDisplay),
      trend: trends.revenue,
      format: (n: number) => formatCurrency(n),
    },
    {
      label: "Avg Order Value",
      value: formatCurrency(aovDisplay),
      trend: trends.aov,
      format: (n: number) => formatCurrency(n),
    },
    {
      label: "Top Selling Item",
      value: kpi.top_item_name || "—",
      sub:
        kpi.top_item_quantity > 0
          ? `${Number(kpi.top_item_quantity)} sold`
          : "No sales yet",
      trend: null as KpiTrend | null,
      format: null as ((n: number) => string) | null,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          tabIndex={card.trend ? 0 : undefined}
          className={cn(
            "group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
            "motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-md",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            {card.trend && <TrendBadge trend={card.trend} />}
          </div>
          <p
            className={cn(
              "mt-3 font-bold tracking-tight text-slate-900",
              card.label === "Top Selling Item" ? "truncate text-xl" : "text-3xl"
            )}
          >
            {card.value}
          </p>
          {card.sub && <p className="mt-1.5 text-xs font-medium text-slate-400">{card.sub}</p>}
          {card.trend && (
            <>
              <p className="mt-2 text-[11px] text-slate-400">vs previous period</p>
              {card.format && (
                <ComparisonTooltip label={card.label} trend={card.trend} format={card.format} />
              )}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
