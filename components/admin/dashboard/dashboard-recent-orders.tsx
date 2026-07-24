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
}: {
  restaurantId: string;
  initialOrders: OrderWithItems[];
}) {
  const { orders } = useRealtimeOrders(restaurantId, initialOrders, {
    activeOnly: false,
    channelName: `admin-dashboard-orders-${restaurantId}`,
    sortNewestFirst: true,
  });

  const recent = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8),
    [orders]
  );

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-4 py-4 sm:px-6">
        <CardTitle className="text-lg">Recent Orders</CardTitle>
        <Badge className="border-0 bg-emerald-50 text-emerald-800">Live</Badge>
      </CardHeader>
      <CardContent className="px-0 pb-2 sm:px-0">
        {recent.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
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
                {recent.map((order) => (
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
          <p className="px-4 py-8 text-center text-muted-foreground sm:px-6">No orders yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
