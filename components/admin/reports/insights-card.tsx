"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Lightbulb,
  Lock,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { brandColorWithAlpha } from "@/lib/brand/restaurant-brand";
import type { ReportInsight, ReportInsightType } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

const ICON_BY_TYPE: Record<
  ReportInsightType,
  { Icon: typeof TrendingUp; className: string; bg: string }
> = {
  trending_up: {
    Icon: TrendingUp,
    className: "text-emerald-600",
    bg: "bg-emerald-50 ring-emerald-100",
  },
  underperforming: {
    Icon: TrendingDown,
    className: "text-amber-600",
    bg: "bg-amber-50 ring-amber-100",
  },
  peak_hours: {
    Icon: Clock3,
    className: "text-sky-600",
    bg: "bg-sky-50 ring-sky-100",
  },
  payment_concentration: {
    Icon: Wallet,
    className: "text-violet-600",
    bg: "bg-violet-50 ring-violet-100",
  },
  revenue_trend: {
    Icon: ArrowUpRight,
    className: "text-slate-700",
    bg: "bg-slate-100 ring-slate-200",
  },
};

function InsightIcon({ insight }: { insight: ReportInsight }) {
  const base = ICON_BY_TYPE[insight.type];
  const isRevenueDown =
    insight.type === "revenue_trend" && insight.meta?.direction === "down";
  const Icon = isRevenueDown ? ArrowDownRight : base.Icon;
  const className = isRevenueDown ? "text-rose-600" : base.className;
  const bg = isRevenueDown ? "bg-rose-50 ring-rose-100" : base.bg;

  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
        bg
      )}
    >
      <Icon className={cn("h-4 w-4", className)} aria-hidden="true" />
    </span>
  );
}

export function InsightsCard({
  insights,
  isPro,
  slug,
  accent,
}: {
  insights: ReportInsight[];
  isPro: boolean;
  slug: string;
  accent: string;
}) {
  if (!isPro) {
    return (
      <article
        className="rounded-xl border px-4 py-4 shadow-sm sm:px-5 sm:py-5"
        style={{
          borderColor: brandColorWithAlpha(accent, 0.35),
          backgroundColor: brandColorWithAlpha(accent, 0.06),
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm"
            style={{ color: accent }}
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Insights</h2>
            <p className="mt-1 text-sm text-slate-600">
              Get short, actionable recommendations from your sales data — trending items, quiet
              menu items, peak staffing windows, and more.
            </p>
            <Link
              href={`/admin/${slug}/billing`}
              className="mt-2 inline-flex text-sm font-semibold underline"
              style={{ color: accent }}
            >
              Upgrade to Pro to unlock Insights
            </Link>
          </div>
        </div>
      </article>
    );
  }

  if (!insights.length) return null;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" />
        <h2 className="text-base font-semibold text-slate-900">Insights</h2>
        <span className="text-xs text-slate-400">Actionable tips from this period</span>
      </div>
      <ul className="space-y-3">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3.5"
          >
            <InsightIcon insight={insight} />
            <div className="min-w-0 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {insight.title}
              </p>
              <p className="mt-0.5 text-sm font-medium leading-snug text-slate-800">
                {insight.message}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
