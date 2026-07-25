"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Flame, Receipt, TrendingUp } from "lucide-react";
import { useAdminBrandColor } from "@/components/admin/admin-brand-context";
import { resolveBrandColor } from "@/lib/brand/restaurant-brand";
import type { ReportData } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils";

const NAVY = "#0F172A";
const INDIGO = "#6366F1";
const GOLD = "#D4A373";

function ChartCard({
  title,
  children,
  chartId,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  chartId: string;
  empty?: boolean;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-4 text-base font-semibold text-[#0F172A]">{title}</h3>
      {empty ? (
        <EmptyChartState />
      ) : (
        <div id={chartId} className="h-64 w-full min-w-0 sm:h-72">
          {children}
        </div>
      )}
    </article>
  );
}

function EmptyChartState({ message = "No data yet for this period." }: { message?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] text-center sm:h-72">
      <BarChart3 className="mb-3 h-9 w-9 text-[#CBD5E1]" aria-hidden="true" />
      <p className="text-sm font-semibold text-[#0F172A]">No data yet</p>
      <p className="mt-1 max-w-xs text-xs text-[#94A3B8]">{message}</p>
    </div>
  );
}

function buildPaymentStackData(paymentSplit: ReportData["paymentSplit"]) {
  const totals = { evc: 0, edahab: 0 };

  for (const row of paymentSplit) {
    const method = row.payment_method.toLowerCase();
    const revenue = Number(row.revenue);
    if (method === "evc") totals.evc += revenue;
    if (method === "edahab") totals.edahab += revenue;
  }

  return [
    {
      payment_method: "Revenue",
      evc: totals.evc,
      edahab: totals.edahab,
    },
  ];
}

function SpikedSection({
  items,
  accent,
}: {
  items: ReportData["spikedItems"];
  accent: string;
}) {
  if (!items.length) {
    return (
      <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-5 w-5" style={{ color: accent }} aria-hidden="true" />
          <h3 className="text-base font-semibold text-[#0F172A]">Trending / Spiked</h3>
        </div>
        <EmptyChartState message="No items with notable growth vs the previous period." />
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Flame className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        <h3 className="text-base font-semibold text-[#0F172A]">Trending / Spiked</h3>
        <span className="text-xs text-[#94A3B8]">Highest % growth vs previous period</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.item_name}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#0F172A]">{item.item_name}</p>
              <p className="mt-0.5 text-xs text-[#64748B]">
                {item.quantity_sold} sold · was {item.previous_quantity}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Spiked {item.growth_percent}%
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function ReportCharts({ data }: { data: ReportData }) {
  const brandAccent = resolveBrandColor(useAdminBrandColor());
  const accent = brandAccent || GOLD;

  const revenueData = data.revenue.map((row) => ({
    period: row.period_label,
    revenue: Number(row.revenue),
    orders: Number(row.order_count),
  }));

  const topItemsData = data.topItems.map((item) => ({
    item_name: item.item_name.length > 14 ? `${item.item_name.slice(0, 14)}…` : item.item_name,
    fullName: item.item_name,
    quantity: Number(item.quantity_sold),
    revenue: Number(item.revenue),
  }));

  const peakHoursData = data.peakHours.map((hour) => ({
    hour: `${String(hour.hour_of_day).padStart(2, "0")}:00`,
    orders: Number(hour.order_count),
  }));

  const hasNoPaymentOrders =
    data.paymentSplit.length === 0 ||
    (data.paymentSplit.length === 1 && data.paymentSplit[0].payment_method === "no_orders");

  const paymentStackData = buildPaymentStackData(
    data.paymentSplit.filter((row) => row.payment_method !== "no_orders")
  );

  const waiterData = data.waiterPerformance.map((waiter) => ({
    name: waiter.waiter_name,
    deliveries: Number(waiter.deliveries),
  }));

  const revenueMax = revenueData.reduce((max, row) => Math.max(max, row.revenue), 0);
  const hasRevenue = revenueData.some((r) => r.revenue > 0);
  const hasTopItems = topItemsData.length > 0;
  const hasPeak = peakHoursData.some((h) => h.orders > 0);
  const hasWaiters = waiterData.length > 0;
  const gradientId = "revenueAreaFill";

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue trend" chartId="chart-revenue" empty={!hasRevenue}>
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
                dataKey="period"
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
                tickFormatter={(value) => formatCurrency(Number(value))}
                domain={[0, Math.max(revenueMax * 1.15, 1)]}
                allowDecimals={false}
                width={64}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]}
                labelFormatter={(label) => String(label)}
                contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={accent}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                connectNulls
                isAnimationActive
                dot={{ r: 3, fill: accent, stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: accent, stroke: NAVY, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 items" chartId="chart-top-items" empty={!hasTopItems}>
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
                isAnimationActive
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <article className="min-w-0 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6 lg:col-span-1">
          <h3 className="mb-4 text-base font-semibold text-[#0F172A]">Least ordered items</h3>
          {data.leastItems.length === 0 ? (
            <EmptyChartState message="No low-volume items in this period." />
          ) : (
            <ul className="space-y-3">
              {data.leastItems.map((item) => (
                <li
                  key={item.item_name}
                  className="flex items-center justify-between gap-2 border-b border-[#F1F5F9] pb-2 last:border-0"
                >
                  <span className="truncate text-sm font-medium text-[#0F172A]">{item.item_name}</span>
                  <span className="shrink-0 text-xs text-[#64748B]">{item.quantity_sold} sold</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <ChartCard title="Peak traffic hours" chartId="chart-peak-hours" empty={!hasPeak}>
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
              <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0" }} />
              <Bar
                dataKey="orders"
                name="Orders"
                fill={NAVY}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                isAnimationActive
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {hasNoPaymentOrders ? (
          <article className="min-w-0 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
            <h3 className="mb-4 text-base font-semibold text-[#0F172A]">Payment split</h3>
            <div className="flex h-64 flex-col items-center justify-center text-center sm:h-72">
              <Receipt className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#0F172A]">No data yet</p>
              <p className="mt-1 max-w-xs text-xs text-gray-400">
                Start serving customers to see payment insights.
              </p>
            </div>
          </article>
        ) : (
          <ChartCard title="Payment split" chartId="chart-payment-split">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentStackData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="payment_method"
                  tick={{ fill: "#64748B", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                />
                <YAxis
                  tick={{ fill: "#64748B", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickFormatter={(value) => formatCurrency(Number(value))}
                />
                <Tooltip
                  formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name)]}
                  contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0" }}
                />
                <Legend />
                <Bar dataKey="evc" name="EVC" stackId="payment" fill={accent} isAnimationActive />
                <Bar
                  dataKey="edahab"
                  name="eDahab"
                  stackId="payment"
                  fill={NAVY}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <ChartCard title="Waiter performance" chartId="chart-waiter-performance" empty={!hasWaiters}>
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
            <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0" }} />
            <Bar
              dataKey="deliveries"
              name="Deliveries"
              fill={accent}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <SpikedSection items={data.spikedItems ?? []} accent={accent} />
    </div>
  );
}
