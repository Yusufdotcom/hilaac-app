"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { formatCurrency, formatDate, formatOrderLabel } from "@/lib/utils";
import type { OrderWithItems } from "@/types/database";

const STATUS_CLASS: Record<string, string> = {
  awaiting_payment: "bg-orange-100 text-orange-900",
  new: "bg-blue-100 text-blue-800",
  preparing: "bg-amber-100 text-amber-900",
  ready: "bg-emerald-100 text-emerald-900",
  delivered: "bg-violet-100 text-violet-900",
  completed: "bg-emerald-100 text-emerald-900",
};

const PAYMENT_CLASS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-900",
  pending: "bg-slate-100 text-slate-700",
  pending_cashier_confirmation: "bg-amber-100 text-amber-900",
  failed: "bg-red-100 text-red-800",
};

export function AdminOrdersBoard({
  restaurantId,
  initialOrders,
}: {
  restaurantId: string;
  initialOrders: OrderWithItems[];
}) {
  const { orders } = useRealtimeOrders(restaurantId, initialOrders, {
    activeOnly: false,
    channelName: `admin-orders-${restaurantId}`,
    sortNewestFirst: true,
  });

  const sorted = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [orders]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Live orders — updates automatically, no refresh needed.</p>
        </div>
        <Badge className="border-0 bg-emerald-50 px-3 py-1 text-emerald-800">Live</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="p-4 font-medium">Order</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Table</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Payment</th>
                  <th className="p-4 font-medium">Delivered by</th>
                  <th className="p-4 font-medium">Method</th>
                  <th className="p-4 font-medium">Total</th>
                  <th className="p-4 font-medium">Placed</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="p-4 font-semibold">
                      {formatOrderLabel(order, { prefix: false })}
                    </td>
                    <td className="p-4 capitalize">{order.order_type}</td>
                    <td className="p-4">{order.table?.table_number ?? "—"}</td>
                    <td className="p-4">
                      <Badge className={`border-0 capitalize ${STATUS_CLASS[order.status] ?? "bg-slate-100"}`}>
                        {order.status.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge
                        className={`border-0 capitalize ${PAYMENT_CLASS[order.payment_status] ?? "bg-slate-100"}`}
                      >
                        {order.payment_status.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">{order.delivered_by ?? "—"}</td>
                    <td className="p-4 uppercase text-muted-foreground">
                      {order.payment_method ?? "—"}
                    </td>
                    <td className="p-4 font-medium">{formatCurrency(Number(order.total))}</td>
                    <td className="p-4 text-muted-foreground">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
