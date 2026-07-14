"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Receipt } from "lucide-react";
import type { ReportData } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils";

const NAVY = "#0F172A";
const GOLD = "#D4A373";
const PIE_COLORS = [GOLD, NAVY, "#64748B", "#1E293B", "#94A3B8"];

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

export function ReportCharts({ data }: { data: ReportData }) {
  const revenueData = data.revenue.map((r) => ({
    label: r.period_label,
    revenue: Number(r.revenue),
    orders: Number(r.order_count),
  }));

  const topItemsData = data.topItems.map((i) => ({
    name: i.item_name.length > 18 ? `${i.item_name.slice(0, 18)}…` : i.item_name,
    fullName: i.item_name,
    quantity: Number(i.quantity_sold),
  }));

  const peakHoursData = data.peakHours.map((h) => ({
    hour: `${String(h.hour_of_day).padStart(2, "0")}:00`,
    orders: Number(h.order_count),
  }));

  const paymentData = data.paymentSplit
    .filter((p) => p.payment_method !== "no_orders")
    .map((p) => ({
      name: p.payment_method,
      value: Number(p.revenue),
    }));

  const hasNoPaymentOrders =
    data.paymentSplit.length === 0 ||
    (data.paymentSplit.length === 1 && data.paymentSplit[0].payment_method === "no_orders");

  const waiterData = data.waiterPerformance.map((w) => ({
    name: w.waiter_name,
    deliveries: Number(w.deliveries),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue trend" chartId="chart-revenue">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value ?? 0))}
                contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0" }}
              />
              <Line type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={2} dot={{ fill: NAVY }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 items" chartId="chart-top-items">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topItemsData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fill: "#64748B", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fill: "#64748B", fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0" }} />
              <Bar dataKey="quantity" fill={GOLD} radius={[0, 4, 4, 0]} />
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
            <BarChart data={peakHoursData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="hour" tick={{ fill: "#64748B", fontSize: 10 }} interval={2} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0" }} />
              <Bar dataKey="orders" fill={NAVY} radius={[4, 4, 0, 0]} />
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
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {paymentData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <ChartCard title="Waiter performance" chartId="chart-waiter-performance">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={waiterData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 11 }} />
            <YAxis tick={{ fill: "#64748B", fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0" }} />
            <Bar dataKey="deliveries" fill={GOLD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
