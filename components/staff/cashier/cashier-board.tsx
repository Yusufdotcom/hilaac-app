"use client";

import { useMemo, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatOrderLabel } from "@/lib/utils";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import type { OrderStatus, OrderWithItems, PaymentStatus } from "@/types/database";

const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  preparing: "bg-amber-100 text-amber-900",
  ready: "bg-emerald-100 text-emerald-900",
  delivered: "bg-violet-100 text-violet-900",
  completed: "bg-emerald-100 text-emerald-900",
};

const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
  failed: "bg-red-100 text-red-800",
};

function formatItems(order: OrderWithItems) {
  if (!order.order_items?.length) return "—";
  return order.order_items
    .map((item) => `${item.quantity}× ${item.menu_item?.name ?? "Item"}`)
    .join(", ");
}

function formatLocation(order: OrderWithItems) {
  if (order.order_type === "takeaway") {
    return "Takeaway";
  }
  return order.table?.table_number ? `Table ${order.table.table_number}` : "Table —";
}

function formatPaymentLabel(status: PaymentStatus) {
  if (status === "paid") return "Paid";
  if (status === "pending") return "Pending";
  return "Failed";
}

function formatOrderStatusLabel(status: OrderStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function PaymentAction({
  order,
  busy,
  onConfirmPayment,
}: {
  order: OrderWithItems;
  busy: boolean;
  onConfirmPayment: () => void;
}) {
  if (order.payment_status === "pending") {
    return (
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={onConfirmPayment}
        className="h-9 rounded-lg bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Payment"}
      </Button>
    );
  }

  if (order.payment_status === "paid") {
    return (
      <Badge className="border-0 bg-emerald-100 px-3 py-1 text-emerald-900">✅ Paid</Badge>
    );
  }

  return <span className="text-xs text-[#94A3B8]">—</span>;
}

export function CashierBoard({
  restaurantId,
  restaurantName,
  initialOrders,
}: {
  restaurantId: string;
  restaurantName: string;
  initialOrders: OrderWithItems[];
}) {
  const { orders, updatePaymentStatus } = useRealtimeOrders(
    restaurantId,
    initialOrders,
    { activeOnly: false }
  );
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [orders]
  );

  const summary = useMemo(
    () => ({
      total: sortedOrders.length,
      paid: sortedOrders.filter((o) => o.payment_status === "paid").length,
      pending: sortedOrders.filter((o) => o.payment_status === "pending").length,
    }),
    [sortedOrders]
  );

  async function handleConfirmPayment(orderId: string) {
    setBusyOrderId(orderId);
    try {
      const error = await updatePaymentStatus(orderId, "paid");
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Payment confirmed");
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F172A] text-[#D4A373]">
            <CreditCard className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Cashier Dashboard</h1>
            <p className="text-sm text-[#64748B]">{restaurantName}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            Orders: {summary.total}
          </Badge>
          <Badge className="border-0 bg-emerald-100 px-3 py-1 text-sm text-emerald-900">
            Paid: {summary.paid}
          </Badge>
          <Badge className="border-0 bg-amber-100 px-3 py-1 text-sm text-amber-900">
            Pending: {summary.pending}
          </Badge>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1024px] text-sm">
            <thead>
              <tr className="border-b bg-[#F8FAFC] text-left text-[#64748B]">
                <th className="px-4 py-3 font-semibold">Order #</th>
                <th className="px-4 py-3 font-semibold">Table / Takeaway</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Payment Status</th>
                <th className="px-4 py-3 font-semibold">Order Status</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-[#F8FAFC]/80">
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">
                    {formatOrderLabel(order, { prefix: false })}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#0F172A]">{formatLocation(order)}</td>
                  <td className="max-w-xs px-4 py-3 text-[#64748B]">
                    <p className="line-clamp-2">{formatItems(order)}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">
                    {formatCurrency(Number(order.total))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={cn(
                        "border-0 capitalize",
                        order.payment_status === "paid"
                          ? "bg-emerald-100 text-emerald-900"
                          : PAYMENT_STATUS_STYLE[order.payment_status]
                      )}
                    >
                      {formatPaymentLabel(order.payment_status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={cn(
                        "border-0 capitalize",
                        order.status === "completed"
                          ? "bg-emerald-100 text-emerald-900"
                          : ORDER_STATUS_STYLE[order.status]
                      )}
                    >
                      {formatOrderStatusLabel(order.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <PaymentAction
                      order={order}
                      busy={busyOrderId === order.id}
                      onConfirmPayment={() => handleConfirmPayment(order.id)}
                    />
                  </td>
                </tr>
              ))}
              {sortedOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-[#64748B]">
                    No orders yet for this restaurant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
