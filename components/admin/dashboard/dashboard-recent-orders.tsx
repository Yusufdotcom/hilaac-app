"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { formatCurrency, formatDate, formatOrderLabel } from "@/lib/utils";
import type { OrderWithItems } from "@/types/database";

export function DashboardRecentOrders({
  restaurantId,
  initialOrders,
  dayStartIso,
  dayEndIso,
  ordersTodayCount,
}: {
  restaurantId: string;
  initialOrders: OrderWithItems[];
  /** Inclusive start of canonical "today" (ISO). */
  dayStartIso: string;
  /** Exclusive end of canonical "today" (ISO). */
  dayEndIso: string;
  /** KPI count — list row count should match this. */
  ordersTodayCount: number;
}) {
  const { orders } = useRealtimeOrders(restaurantId, initialOrders, {
    activeOnly: false,
    channelName: `admin-dashboard-orders-${restaurantId}`,
    sortNewestFirst: true,
  });

  const todaysOrders = useMemo(() => {
    const startMs = new Date(dayStartIso).getTime();
    const endMs = new Date(dayEndIso).getTime();
    return [...orders]
      .filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= startMs && t < endMs;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, dayStartIso, dayEndIso]);

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <CardTitle className="text-lg">Today&apos;s Orders</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {todaysOrders.length} order{todaysOrders.length === 1 ? "" : "s"}
            {todaysOrders.length !== ordersTodayCount
              ? ` (KPI: ${ordersTodayCount})`
              : ""}
          </p>
        </div>
        <Badge className="border-0 bg-emerald-50 text-emerald-800">Live</Badge>
      </CardHeader>
      <CardContent className="px-0 pb-2 sm:px-0">
        {todaysOrders.length > 0 ? (
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-max min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="whitespace-nowrap px-4 pb-2 font-medium sm:px-6">Order</th>
                  <th className="whitespace-nowrap px-4 pb-2 font-medium">Type</th>
                  <th className="whitespace-nowrap px-4 pb-2 font-medium">Status</th>
                  <th className="whitespace-nowrap px-4 pb-2 font-medium">Payment</th>
                  <th className="whitespace-nowrap px-4 pb-2 font-medium">Total</th>
                  <th className="whitespace-nowrap px-4 pb-2 pr-4 font-medium sm:pr-6">Time</th>
                </tr>
              </thead>
              <tbody>
                {todaysOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold sm:px-6">
                      {formatOrderLabel(order, { prefix: false })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 capitalize">{order.order_type}</td>
                    <td className="max-w-[8rem] truncate px-4 py-2.5 capitalize">
                      {order.status.replaceAll("_", " ")}
                    </td>
                    <td className="max-w-[9rem] truncate px-4 py-2.5 capitalize">
                      {order.payment_status.replaceAll("_", " ")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {formatCurrency(Number(order.total))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 pr-4 text-muted-foreground sm:pr-6">
                      {formatDate(order.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-muted-foreground sm:px-6">
            No orders yet today.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
