"use client";

import { Sparkles } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { cn, formatCurrency } from "@/lib/utils";
import type { CustomerIntelligenceData } from "@/lib/customers/fetch-customer-intelligence";
import type { CustomerSegment } from "@/lib/customers/customer-segments";

const SEGMENT_META: Record<
  CustomerSegment,
  { label: string; bar: string; text: string }
> = {
  vip: { label: "VIP", bar: "bg-emerald-600", text: "text-emerald-700" },
  regular: { label: "Regular", bar: "bg-teal-500", text: "text-teal-700" },
  new: { label: "New", bar: "bg-lime-500", text: "text-lime-800" },
  at_risk: { label: "At-Risk", bar: "bg-red-500", text: "text-red-700" },
};

export function CustomersView({
  data,
  gated,
}: {
  data: CustomerIntelligenceData | null;
  gated?: boolean;
}) {
  if (gated) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
          Customer Intelligence is on Galeyr 1.0
        </p>
        <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
          Upgrade to see segments, feedback, and top products by guest.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-[var(--admin-muted,#64748B)]">Could not load customers.</p>
    );
  }

  const denom = Math.max(data.segmentTotal, 1);
  const fb = data.feedback;
  const fbTotal = Math.max(fb.total, 1);

  return (
    <div className="w-full min-w-0 space-y-6">
      <AdminPageIntro>
        Who keeps coming back, who&apos;s at risk, and what they order most.
      </AdminPageIntro>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total Customers" value={String(data.totalCustomers)} />
        <Kpi label="New (this month)" value={String(data.newThisMonth)} />
        <Kpi label="Returning" value={String(data.returningCount)} />
        <Kpi label="Avg Spend" value={formatCurrency(data.avgSpend)} />
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5">
        <h3 className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">Segments</h3>
        <div className="space-y-3">
          {(["vip", "regular", "new", "at_risk"] as CustomerSegment[]).map((key) => {
            const meta = SEGMENT_META[key];
            const count = data.segments[key];
            const pct = Math.round((count / denom) * 1000) / 10;
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className={cn("font-semibold", meta.text)}>{meta.label}</span>
                  <span className="tabular-nums text-[var(--admin-muted,#64748B)]">
                    {count} · {data.segmentTotal === 0 ? 0 : pct}%
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--admin-subtle,#F1F5F9)]">
                  <div
                    className={cn("h-full rounded-full", meta.bar)}
                    style={{
                      width: `${data.segmentTotal === 0 ? 0 : Math.max(count > 0 ? 4 : 0, (count / denom) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {data.returningSalesPct != null ? (
          <div className="flex items-start gap-2 rounded-xl border border-[var(--admin-border)] px-3 py-2.5 text-sm">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A373]" aria-hidden="true" />
            <p>
              Returning customers make up{" "}
              <span className="font-semibold">{data.returningSalesPct}%</span> of your sales
              this month.
            </p>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5">
          <h3 className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">Feedback</h3>
          <p className="mt-0.5 text-xs text-[var(--admin-muted,#64748B)]">
            From guest star ratings after delivery (last 30 days).
          </p>
          {fb.total === 0 ? (
            <p className="mt-6 text-sm text-[var(--admin-muted,#64748B)]">
              No ratings yet — guests can rate once an order is delivered.
            </p>
          ) : (
            <div className="mt-6 flex items-center gap-6">
              <FeedbackDonut
                positive={fb.positive}
                neutral={fb.neutral}
                negative={fb.negative}
                total={fbTotal}
              />
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Positive {fb.positive}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  Neutral {fb.neutral}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  Negative {fb.negative}
                </li>
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5">
          <h3 className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
            Top products by customer
          </h3>
          <p className="mt-0.5 text-xs text-[var(--admin-muted,#64748B)]">This month</p>
          {data.topProducts.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--admin-muted,#64748B)]">
              No paid item sales this month yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--admin-border)]">
              {data.topProducts.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-[var(--admin-text,#0F172A)]">
                    {p.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--admin-muted,#64748B)]">
                    {p.quantity} · {formatCurrency(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4">
      <p className="text-xs text-[var(--admin-muted,#64748B)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--admin-text,#0F172A)]">
        {value}
      </p>
    </div>
  );
}

function FeedbackDonut({
  positive,
  neutral,
  negative,
  total,
}: {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}) {
  const p = (positive / total) * 100;
  const n = (neutral / total) * 100;
  const g = (negative / total) * 100;
  const gradient = `conic-gradient(#10b981 0 ${p}%, #94a3b8 ${p}% ${p + n}%, #ef4444 ${p + n}% ${p + n + g}%)`;

  return (
    <div
      className="relative h-28 w-28 shrink-0 rounded-full"
      style={{ background: gradient }}
      aria-hidden="true"
    >
      <div className="absolute inset-3 flex items-center justify-center rounded-full bg-[var(--admin-card,#fff)] text-sm font-bold tabular-nums text-[var(--admin-text,#0F172A)]">
        {total}
      </div>
    </div>
  );
}
