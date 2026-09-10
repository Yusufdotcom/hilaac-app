"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  DollarSign,
  Table2,
  Clock,
  CreditCard,
} from "lucide-react";
import { DashboardStatCard } from "@/components/admin/dashboard/dashboard-stat-card";
import { useLocale } from "@/components/i18n/locale-provider";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { isAwaitingCashierConfirmation } from "@/lib/payments/constants";
import { formatCurrency } from "@/lib/utils";
import type { OrderWithItems } from "@/types/database";

function pctChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Live KPI strip — same Realtime channel pattern as Kitchen/Cashier.
 * Recalculates Orders Today / Revenue Today / Open Orders / awaiting confirm from the order stream.
 */
export function DashboardLiveStats({
  restaurantId,
  initialOrders,
  dayStartIso,
  dayEndIso,
  ordersYesterday,
  revenueYesterday,
  activeTables,
  totalTables,
  sparklineOrders,
  sparklineRevenue,
  sparklineActiveTables,
  sparklineOpenOrders,
  slug,
}: {
  restaurantId: string;
  /** All orders created today (any payment status) — seed for realtime. */
  initialOrders: OrderWithItems[];
  dayStartIso: string;
  dayEndIso: string;
  ordersYesterday: number;
  revenueYesterday: number;
  activeTables: number;
  totalTables: number;
  sparklineOrders: number[];
  sparklineRevenue: number[];
  sparklineActiveTables: number[];
  sparklineOpenOrders: number[];
  slug: string;
}) {
  const { orders } = useRealtimeOrders(restaurantId, initialOrders, {
    activeOnly: false,
    channelName: `admin-dashboard-kpi-${restaurantId}`,
    sortNewestFirst: true,
  });
  const { t } = useLocale();

  const startMs = new Date(dayStartIso).getTime();
  const endMs = new Date(dayEndIso).getTime();

  const stats = useMemo(() => {
    const today = orders.filter((o) => {
      const created = new Date(o.created_at).getTime();
      return created >= startMs && created < endMs;
    });
    const paid = today.filter((o) => o.payment_status === "paid");
    const ordersToday = paid.length;
    const revenueToday = paid.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    const openOrders = today.filter(
      (o) => o.status !== "completed" && o.status !== "delivered" && o.status !== "cancelled"
    ).length;
    const awaitingPaymentConfirmation = orders.filter((o) =>
      isAwaitingCashierConfirmation(o)
    ).length;

    return {
      ordersToday,
      revenueToday,
      openOrders,
      awaitingPaymentConfirmation,
      ordersDelta: pctChange(ordersToday, ordersYesterday),
      revenueDelta: pctChange(revenueToday, revenueYesterday),
    };
  }, [orders, startMs, endMs, ordersYesterday, revenueYesterday]);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          label={t("dash.ordersToday")}
          value={stats.ordersToday}
          icon={ShoppingBag}
          delta={stats.ordersDelta}
          sparkline={sparklineOrders}
        />
        <DashboardStatCard
          label={t("dash.revenueToday")}
          value={formatCurrency(stats.revenueToday)}
          icon={DollarSign}
          delta={stats.revenueDelta}
          sparkline={sparklineRevenue}
        />
        <DashboardStatCard
          label={t("dash.activeTables")}
          value={
            <>
              {activeTables}{" "}
              <span className="text-sm font-normal text-[var(--admin-muted)]">
                / {totalTables}
              </span>
            </>
          }
          icon={Table2}
          delta={null}
          sparkline={sparklineActiveTables}
        />
        <DashboardStatCard
          label={t("dash.openOrders")}
          value={stats.openOrders}
          icon={Clock}
          delta={null}
          sparkline={sparklineOpenOrders}
        />
      </div>

      {stats.awaitingPaymentConfirmation > 0 && (
        <div
          className="admin-brand-tint flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          style={{
            borderColor: "color-mix(in srgb, var(--admin-brand, #9E2E2E) 25%, transparent)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: "var(--admin-brand, #9E2E2E)" }}
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--admin-brand, #9E2E2E)" }}>
                {stats.awaitingPaymentConfirmation}{" "}
                {stats.awaitingPaymentConfirmation === 1 ? "order" : "orders"} awaiting payment
                confirmation
              </p>
              <p className="text-xs text-[var(--admin-muted,#64748B)]">
                Not counted in today&apos;s paid Orders/Revenue. Includes older backlog.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/${slug}/orders`}
            className="w-full shrink-0 rounded-xl px-4 py-2 text-center text-sm font-semibold text-white sm:w-auto"
            style={{ backgroundColor: "var(--admin-brand, #9E2E2E)" }}
          >
            Review orders
          </Link>
        </div>
      )}
    </>
  );
}
