"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Receipt } from "lucide-react";
import { useAdminBrandColor } from "@/components/admin/admin-brand-context";
import { resolveBrandColor } from "@/lib/brand/restaurant-brand";
import type { ReportData } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils";

const NAVY = "#0F172A";

function ChartCard({
  title,
  children,
  chartId,
}: {
  title: string;
  children: React.ReactNode;
  chartId: string;
}) {
  return (
    <article className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-4 text-base font-semibold text-[#0F172A]">{title}</h3>
      <div id={chartId} className="h-64 w-full min-w-0 sm:h-72">
        {children}
      </div>
    </article>
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

export function ReportCharts({ data }: { data: ReportData }) {
  const accent = resolveBrandColor(useAdminBrandColor());
  const revenueData = data.revenue.map((row) => ({
    period: row.period_label,
    revenue: Number(row.revenue),
    orders: Number(row.order_count),
  }));

  const topItemsData = data.topItems.map((item) => ({
    item_name: item.item_name.length > 16 ? `${item.item_name.slice(0, 16)}…` : item.item_name,
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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue trend" chartId="chart-revenue">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
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
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]}
                labelFormatter={(label) => String(label)}
                contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0" }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={accent}
                strokeWidth={3}
                connectNulls
                isAnimationActive={false}
                dot={{ r: 4, fill: accent, stroke: NAVY, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: accent, stroke: NAVY, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 items" chartId="chart-top-items">
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
                contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0" }}
                formatter={(value, _name, item) => [
                  Number(value ?? 0),
                  "Quantity sold",
                ]}
                labelFormatter={(_label, payload) =>
                  String(payload?.[0]?.payload?.fullName ?? _label)
                }
              />
              <Bar
                dataKey="quantity"
                name="Quantity"
                fill={accent}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6 lg:col-span-1">
          <h3 className="mb-4 text-base font-semibold text-[#0F172A]">Least ordered items</h3>
          <ul className="space-y-3">
            {data.leastItems.length === 0 ? (
              <li className="text-sm text-[#94A3B8]">No data for this period.</li>
            ) : (
              data.leastItems.map((item) => (
                <li
                  key={item.item_name}
                  className="flex items-center justify-between gap-2 border-b border-[#F1F5F9] pb-2 last:border-0"
                >
                  <span className="text-sm font-medium text-[#0F172A]">{item.item_name}</span>
                  <span className="text-xs text-[#64748B]">{item.quantity_sold} sold</span>
                </li>
              ))
            )}
          </ul>
        </article>

        <ChartCard title="Peak traffic hours" chartId="chart-peak-hours">
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
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0" }} />
              <Bar
                dataKey="orders"
                name="Orders"
                fill={NAVY}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {hasNoPaymentOrders ? (
          <article className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
            <h3 className="mb-4 text-base font-semibold text-[#0F172A]">Payment split</h3>
            <div className="flex h-64 flex-col items-center justify-center text-center sm:h-72">
              <Receipt className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
              <p className="max-w-xs text-sm text-gray-400">
                No orders yet. Start serving customers to see payment insights.
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
                  contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0" }}
                />
                <Legend />
                <Bar
                  dataKey="evc"
                  name="EVC"
                  stackId="payment"
                  fill={accent}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="edahab"
                  name="eDahab"
                  stackId="payment"
                  fill={NAVY}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <ChartCard title="Waiter performance" chartId="chart-waiter-performance">
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
            <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0" }} />
            <Bar
              dataKey="deliveries"
              name="Deliveries"
              fill={accent}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
