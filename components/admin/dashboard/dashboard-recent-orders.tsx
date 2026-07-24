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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg">Recent Orders</CardTitle>
        <Badge className="border-0 bg-emerald-50 text-emerald-800">Live</Badge>
      </CardHeader>
      <CardContent>
        {recent.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Order</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Payment</th>
                  <th className="pb-2 pr-4 font-medium">Total</th>
                  <th className="pb-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-semibold">
                      {formatOrderLabel(order, { prefix: false })}
                    </td>
                    <td className="py-2 pr-4 capitalize">{order.order_type}</td>
                    <td className="py-2 pr-4 capitalize">{order.status.replaceAll("_", " ")}</td>
                    <td className="py-2 pr-4 capitalize">
                      {order.payment_status.replaceAll("_", " ")}
                    </td>
                    <td className="py-2 pr-4">{formatCurrency(Number(order.total))}</td>
                    <td className="py-2 text-muted-foreground">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-muted-foreground">No orders yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
