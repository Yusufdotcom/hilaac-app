"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Flame, TrendingUp, Users } from "lucide-react";
import { useAdminBrandColor } from "@/components/admin/admin-brand-context";
import { resolveBrandColor } from "@/lib/brand/restaurant-brand";
import type { ReportData } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils";

const NAVY = "#0F172A";
const INDIGO = "#6366F1";
const GOLD = "#D4A373";
/** Display label → slice/legend color (must stay in sync). */
const PAYMENT_COLORS: Record<string, string> = {
  EVC: "#10B981",
  eDahab: "#D4A373",
  Cash: "#64748B",
};

const PAYMENT_METHODS = ["EVC", "eDahab", "Cash"] as const;

function canonicalizePaymentMethod(raw: string): (typeof PAYMENT_METHODS)[number] {
  const key = raw.toLowerCase().replace(/[-_\s]/g, "");
  if (key === "evc") return "EVC";
  if (key === "edahab") return "eDahab";
  return "Cash";
}

const EMPTY_PERIOD = "No data available for this period.";

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

function PreviousPeriodToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300"
      />
      Previous period
    </label>
  );
}

function ChartCard({
  title,
  children,
  chartId,
  empty,
  emptyMessage = EMPTY_PERIOD,
  headerRight,
}: {
  title: string;
  children: React.ReactNode;
  chartId?: string;
  empty?: boolean;
  emptyMessage?: string;
  headerRight?: React.ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {headerRight}
      </div>
      {empty ? (
        <EmptyChartState message={emptyMessage} />
      ) : (
        <div id={chartId} className="h-64 w-full min-w-0 sm:h-72">
          {children}
        </div>
      )}
    </article>
  );
}

function EmptyChartState({ message = EMPTY_PERIOD }: { message?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center sm:h-72">
      <BarChart3 className="mb-3 h-9 w-9 text-slate-300" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-900">No data available</p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">{message}</p>
    </div>
  );
}

function SpikedSection({ items }: { items: ReportData["spikedItems"] }) {
  if (!items.length) {
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <h3 className="text-base font-semibold text-slate-900">Trending / Spiked</h3>
        </div>
        <EmptyChartState message="No items with notable growth vs the previous period." />
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Flame className="h-5 w-5 text-[#10B981]" aria-hidden="true" />
        <h3 className="text-base font-semibold text-slate-900">Trending / Spiked</h3>
        <span className="text-xs text-slate-400">Highest % growth vs previous period</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.item_name}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{item.item_name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {Number(item.quantity_sold)} sold · was {Number(item.previous_quantity)}
              </p>
            </div>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold ring-1 ring-emerald-100"
              style={{ color: "#10B981" }}
            >
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>+{item.growth_percent}%</span>
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function useReportChartData(data: ReportData) {
  const revenueData = useMemo(() => {
    const prev = data.previousRevenue ?? [];
    return data.revenue.map((row, idx) => ({
      periodKey: row.period_start || `${row.period_label}-${idx}`,
      period: row.period_label,
      revenue: Number(row.revenue) || 0,
      orders: Number(row.order_count) || 0,
      previousRevenue: Number(prev[idx]?.revenue ?? 0) || 0,
      previousOrders: Number(prev[idx]?.order_count ?? 0) || 0,
    }));
  }, [data.revenue, data.previousRevenue]);

  const topItemsData = useMemo(
    () =>
      data.topItems.map((item) => ({
        item_name: item.item_name.length > 14 ? `${item.item_name.slice(0, 14)}…` : item.item_name,
        fullName: item.item_name,
        quantity: Number(item.quantity_sold) || 0,
        revenue: Number(item.revenue) || 0,
      })),
    [data.topItems]
  );

  const peakHoursData = useMemo(
    () =>
      data.peakHours.map((hour) => ({
        hour: `${String(hour.hour_of_day).padStart(2, "0")}:00`,
        orders: Number(hour.order_count) || 0,
      })),
    [data.peakHours]
  );

  const peakDay = useMemo(() => {
    const days = data.peakDays ?? [];
    if (!days.length) return null;
    return days.reduce((best, day) => (day.order_count > best.order_count ? day : best));
  }, [data.peakDays]);

  /**
   * Always three methods with numeric revenue ≥ 0 (never null).
   * Canonical Recharts shape: { name, value, fill } plus display fields.
   */
  const paymentData = useMemo(() => {
    const byMethod = new Map<string, { order_count: number; revenue: number }>();
    for (const row of data.paymentSplit ?? []) {
      const method = canonicalizePaymentMethod(String(row.payment_method ?? "Cash"));
      const prev = byMethod.get(method) ?? { order_count: 0, revenue: 0 };
      byMethod.set(method, {
        order_count: prev.order_count + (Number(row.order_count) || 0),
        revenue: prev.revenue + (Number(row.revenue) || 0),
      });
    }

    return PAYMENT_METHODS.map((method) => {
      const found = byMethod.get(method);
      const revenue = Number(found?.revenue ?? 0) || 0;
      const order_count = Number(found?.order_count ?? 0) || 0;
      return {
        name: method,
        value: revenue,
        fill: PAYMENT_COLORS[method],
        payment_method: method,
        order_count,
        revenue,
      };
    });
  }, [data.paymentSplit]);

  const paymentPieSlices = useMemo(
    () => paymentData.filter((p) => p.value > 0),
    [paymentData]
  );

  const waiterData = useMemo(
    () =>
      data.waiterPerformance.map((waiter) => ({
        name: waiter.waiter_name,
        deliveries: Number(waiter.deliveries) || 0,
        revenue: Number(waiter.revenue) || 0,
      })),
    [data.waiterPerformance]
  );

  return {
    revenueData,
    topItemsData,
    peakHoursData,
    peakDay,
    paymentData,
    paymentPieSlices,
    waiterData,
    revenuePeriodTotal: data.kpi.total_revenue,
  };
}

export function RevenueTrendPanel({
  data,
  showPrevious,
  onShowPreviousChange,
  compact,
}: {
  data: ReportData;
  showPrevious: boolean;
  onShowPreviousChange: (v: boolean) => void;
  compact?: boolean;
}) {
  const brandAccent = resolveBrandColor(useAdminBrandColor());
  const accent = brandAccent || GOLD;
  const reduceMotion = usePrefersReducedMotion();
  const { revenueData, revenuePeriodTotal } = useReportChartData(data);
  const revenueMax = useMemo(
    () =>
      revenueData.reduce(
        (max, row) => Math.max(max, row.revenue, showPrevious ? row.previousRevenue : 0),
        0
      ),
    [revenueData, showPrevious]
  );
  const hasRevenue = revenueData.some((r) => r.revenue > 0 || r.previousRevenue > 0);
  const gradientId = compact ? "insightsRevenueFillCompact" : "insightsRevenueFill";

  return (
    <ChartCard
      title="Revenue trend"
      chartId="chart-revenue"
      empty={!hasRevenue}
      headerRight={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-xs font-medium text-slate-500">
            Period total {formatCurrency(revenuePeriodTotal)}
          </span>
          <PreviousPeriodToggle checked={showPrevious} onChange={onShowPreviousChange} />
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={revenueData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            dataKey="periodKey"
            tick={{ fill: "#64748B", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#E2E8F0" }}
            tickFormatter={(_value, index) => revenueData[index]?.period ?? ""}
          />
          <YAxis
            tick={{ fill: "#64748B", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#E2E8F0" }}
            tickFormatter={(value) => formatCurrency(Number(value))}
            domain={[0, Math.max(revenueMax * 1.15, 1)]}
            allowDecimals
            width={72}
          />
          <Tooltip
            formatter={(value, name) => {
              const amount = formatCurrency(Number(value ?? 0));
              if (name === "previousRevenue") return [`Previous period: ${amount}`, ""];
              return [`Revenue: ${amount}`, ""];
            }}
            labelFormatter={(_label, payload) =>
              String(payload?.[0]?.payload?.period ?? _label)
            }
            contentStyle={{
              borderRadius: 12,
              borderColor: "#E2E8F0",
              boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
            }}
          />
          {showPrevious && (
            <Line
              type="monotone"
              dataKey="previousRevenue"
              name="previousRevenue"
              stroke="#94A3B8"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={!reduceMotion}
            />
          )}
          <Area
            type="monotone"
            dataKey="revenue"
            name="revenue"
            stroke={accent}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            connectNulls
            isAnimationActive={!reduceMotion}
            dot={{ r: 3, fill: accent, stroke: "#fff", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: accent, stroke: NAVY, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function PaymentSplitPanel({ data }: { data: ReportData }) {
  const reduceMotion = usePrefersReducedMotion();
  const { paymentData, paymentPieSlices } = useReportChartData(data);
  const hasPaymentRevenue = paymentPieSlices.length > 0;
  const pieTotal = paymentPieSlices.reduce((sum, p) => sum + p.value, 0);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info("[reports] PaymentSplit Pie data", {
        paymentData,
        paymentPieSlices,
        pieTotal,
      });
    }
  }, [paymentData, paymentPieSlices, pieTotal]);

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Payment split</h3>
      {!hasPaymentRevenue ? (
        <EmptyChartState />
      ) : (
        <div id="chart-payment-split" className="flex w-full flex-col">
          <div className="mx-auto h-[220px] w-full max-w-[320px]">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={paymentPieSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={paymentPieSlices.length > 1 ? 2 : 0}
                  stroke="#ffffff"
                  strokeWidth={2}
                  isAnimationActive={!reduceMotion}
                >
                  {paymentPieSlices.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const amount = Number(value ?? 0);
                    const pct = pieTotal > 0 ? Math.round((amount / pieTotal) * 1000) / 10 : 0;
                    return [`${formatCurrency(amount)} (${pct}%)`, String(name)];
                  }}
                  contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            {paymentData.map((p) => (
              <li
                key={p.name}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600"
                title={`${p.name}: ${formatCurrency(p.value)} · ${p.order_count} orders`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.fill }}
                  aria-hidden="true"
                />
                <span>
                  {p.name} ({formatCurrency(p.value)})
                  {p.value === 0 ? (
                    <span className="text-slate-400"> · none this period</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function MenuPerformancePanel({ data }: { data: ReportData }) {
  const reduceMotion = usePrefersReducedMotion();
  const { topItemsData } = useReportChartData(data);
  const hasTopItems = topItemsData.length > 0;

  return (
    <div className="space-y-6">
      <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-base font-semibold text-slate-900">Top 10 items</h3>
        {!hasTopItems ? (
          <EmptyChartState />
        ) : (
          <>
            <div id="chart-top-items" className="h-56 w-full overflow-x-auto sm:h-64">
              <div className="h-full" style={{ minWidth: Math.max(320, topItemsData.length * 56) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItemsData} margin={{ top: 8, right: 16, left: 8, bottom: 64 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="item_name"
                      tick={{ fill: "#64748B", fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: "#E2E8F0" }}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "#E2E8F0" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0" }}
                      formatter={(value) => [Number(value ?? 0), "Quantity sold"]}
                      labelFormatter={(_label, payload) =>
                        String(payload?.[0]?.payload?.fullName ?? _label)
                      }
                    />
                    <Bar
                      dataKey="quantity"
                      name="Quantity"
                      fill={INDIGO}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                      isAnimationActive={!reduceMotion}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Least ordered
              </p>
              {data.leastItems.length === 0 ? (
                <p className="text-xs text-slate-400">No low-volume items in this period.</p>
              ) : (
                <ul className="space-y-2">
                  {data.leastItems.slice(0, 5).map((item) => {
                    const qty = Number(item.quantity_sold ?? 0) || 0;
                    return (
                      <li
                        key={item.item_name}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate text-sm font-medium text-slate-900">
                          {item.item_name}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-slate-500">
                          {qty} sold
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </article>
      <SpikedSection items={data.spikedItems ?? []} />
    </div>
  );
}

export function TrafficTimingPanel({
  data,
  showPrevious,
  onShowPreviousChange,
}: {
  data: ReportData;
  showPrevious: boolean;
  onShowPreviousChange: (v: boolean) => void;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const { peakHoursData, peakDay, revenueData } = useReportChartData(data);
  const hasPeak = peakHoursData.some((h) => h.orders > 0);

  // Orders trend uses same buckets as revenue (paid order_count per day).
  const ordersTrend = useMemo(
    () =>
      revenueData.map((r) => ({
        periodKey: r.periodKey,
        period: r.period,
        orders: r.orders,
        previousOrders: r.previousOrders,
      })),
    [revenueData]
  );
  const ordersMax = useMemo(
    () =>
      ordersTrend.reduce(
        (max, row) => Math.max(max, row.orders, showPrevious ? row.previousOrders : 0),
        0
      ),
    [ordersTrend, showPrevious]
  );
  const hasOrdersTrend = ordersTrend.some((r) => r.orders > 0 || r.previousOrders > 0);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <ChartCard
        title="Orders over time"
        empty={!hasOrdersTrend}
        headerRight={
          <PreviousPeriodToggle checked={showPrevious} onChange={onShowPreviousChange} />
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={ordersTrend} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="periodKey"
              tick={{ fill: "#64748B", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
              tickFormatter={(_value, index) => ordersTrend[index]?.period ?? ""}
            />
            <YAxis
              tick={{ fill: "#64748B", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
              domain={[0, Math.max(ordersMax * 1.15, 1)]}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(value, name) => [
                Number(value ?? 0),
                name === "previousOrders" ? "Previous period" : "Orders",
              ]}
              labelFormatter={(_label, payload) =>
                String(payload?.[0]?.payload?.period ?? _label)
              }
              contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0" }}
            />
            {showPrevious && (
              <Line
                type="monotone"
                dataKey="previousOrders"
                name="previousOrders"
                stroke="#94A3B8"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                isAnimationActive={!reduceMotion}
              />
            )}
            <Area
              type="monotone"
              dataKey="orders"
              name="orders"
              stroke={NAVY}
              strokeWidth={2}
              fill="#0F172A18"
              isAnimationActive={!reduceMotion}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Peak traffic hours"
        chartId="chart-peak-hours"
        empty={!hasPeak}
        headerRight={
          peakDay && peakDay.order_count > 0 ? (
            <span
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
              title={`${peakDay.day_label} had the most orders (${peakDay.order_count}) in this period`}
            >
              Peak day: {peakDay.day_label}
            </span>
          ) : null
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={peakHoursData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: "#64748B", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
              interval={2}
            />
            <YAxis
              tick={{ fill: "#64748B", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0" }}
              formatter={(value) => [Number(value ?? 0), "Orders"]}
              labelFormatter={(label) => {
                const peakNote =
                  peakDay && peakDay.order_count > 0
                    ? ` · Peak day: ${peakDay.day_label}`
                    : "";
                return `${label}${peakNote}`;
              }}
            />
            <Bar
              dataKey="orders"
              name="Orders"
              fill={NAVY}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              isAnimationActive={!reduceMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export function StaffPerformancePanel({
  data,
  waiterError,
  onRetryWaiter,
}: {
  data: ReportData;
  waiterError?: string | null;
  onRetryWaiter?: () => void;
}) {
  const brandAccent = resolveBrandColor(useAdminBrandColor());
  const accent = brandAccent || GOLD;
  const reduceMotion = usePrefersReducedMotion();
  const { waiterData } = useReportChartData(data);
  const hasWaiters = waiterData.length > 0;

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Waiter performance</h3>
      {waiterError ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50 px-4 text-center sm:h-72">
          <p className="text-sm font-semibold text-red-800">Failed to load waiter performance</p>
          <p className="max-w-sm text-xs text-red-600">{waiterError}</p>
          {onRetryWaiter && (
            <button
              type="button"
              onClick={onRetryWaiter}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50"
            >
              Retry
            </button>
          )}
        </div>
      ) : !hasWaiters ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center sm:h-72">
          <Users className="mb-3 h-9 w-9 text-slate-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-900">No waiter deliveries recorded yet</p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            When staff mark orders as delivered with their name, performance stats appear here.
          </p>
        </div>
      ) : (
        <div id="chart-waiter-performance" className="h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waiterData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0" }}
                formatter={(value, name) =>
                  name === "revenue"
                    ? [formatCurrency(Number(value ?? 0)), "Revenue"]
                    : [Number(value ?? 0), "Deliveries"]
                }
              />
              <Bar
                dataKey="deliveries"
                name="deliveries"
                fill={accent}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
                isAnimationActive={!reduceMotion}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

export function RevenueDeepDivePanel({
  data,
  showPrevious,
  onShowPreviousChange,
}: {
  data: ReportData;
  showPrevious: boolean;
  onShowPreviousChange: (v: boolean) => void;
}) {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <RevenueTrendPanel
        data={data}
        showPrevious={showPrevious}
        onShowPreviousChange={onShowPreviousChange}
      />
      <PaymentSplitPanel data={data} />
    </div>
  );
}

/** @deprecated Prefer tabbed panels; kept for export chart IDs during PDF capture. */
export function ReportCharts({
  data,
  waiterError,
  onRetryWaiter,
}: {
  data: ReportData;
  waiterError?: string | null;
  onRetryWaiter?: () => void;
}) {
  const [showPrevious, setShowPrevious] = useState(true);
  return (
    <div className="space-y-6">
      <RevenueDeepDivePanel
        data={data}
        showPrevious={showPrevious}
        onShowPreviousChange={setShowPrevious}
      />
      <MenuPerformancePanel data={data} />
      <TrafficTimingPanel
        data={data}
        showPrevious={showPrevious}
        onShowPreviousChange={setShowPrevious}
      />
      <StaffPerformancePanel
        data={data}
        waiterError={waiterError}
        onRetryWaiter={onRetryWaiter}
      />
    </div>
  );
}
