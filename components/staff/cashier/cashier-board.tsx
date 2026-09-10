"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatOrderLabel } from "@/lib/utils";
import { OrderCustomerPhone } from "@/components/staff/order-customer-phone";
import { AcceptOrdersQueue } from "@/components/staff/accept-orders-queue";
import { LoyaltyLookupPanel } from "@/components/staff/cashier/loyalty-lookup-panel";
import { PackagePassScanPanel } from "@/components/staff/cashier/package-pass-scan-panel";
import {
  ManualPosDialog,
  type ManualPosMenuBundle,
} from "@/components/admin/orders/manual-pos-dialog";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { filterAwaitingAcceptance } from "@/lib/order/acceptance";
import { needsCashierPaymentConfirmation } from "@/lib/order/cashier-payment";
import type { OrderStatus, OrderWithItems, PaymentStatus } from "@/types/database";
import { PENDING_CASHIER_CONFIRMATION, isAwaitingCashierConfirmation } from "@/lib/payments/constants";

const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  awaiting_payment: "bg-orange-100 text-orange-900",
  new: "bg-blue-100 text-blue-800",
  preparing: "bg-amber-100 text-amber-900",
  ready: "bg-emerald-100 text-emerald-900",
  delivered: "bg-violet-100 text-violet-900",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-red-100 text-red-800",
};

const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  pending_cashier_confirmation: "bg-amber-100 text-amber-900",
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

function formatPaymentBadge(order: OrderWithItems) {
  if (order.payment_status === "paid") {
    return {
      label: "✅ Paid",
      className: "bg-emerald-100 text-emerald-900",
    };
  }

  if (isAwaitingCashierConfirmation(order)) {
    return {
      label: order.customer_confirmed_at
        ? "Customer confirmed – Awaiting Cashier"
        : "API payment – Awaiting Cashier",
      className: "bg-amber-100 text-amber-900",
    };
  }

  if (order.payment_status === "pending") {
    return {
      label: "Pending",
      className: "bg-slate-100 text-slate-600",
    };
  }

  return {
    label: formatPaymentLabel(order.payment_status),
    className: PAYMENT_STATUS_STYLE[order.payment_status],
  };
}

function formatPaymentLabel(status: PaymentStatus) {
  if (status === "paid") return "Paid";
  if (status === PENDING_CASHIER_CONFIRMATION) return "Awaiting cashier";
  if (status === "pending") return "Pending";
  return "Failed";
}

function formatOrderStatusLabel(status: OrderStatus) {
  if (status === "awaiting_payment") return "Awaiting payment";
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
  if (needsCashierPaymentConfirmation(order) || isAwaitingCashierConfirmation(order)) {
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
  slug,
  initialOrders,
  posMenu,
  canScanPackages = false,
}: {
  restaurantId: string;
  restaurantName: string;
  slug: string;
  initialOrders: OrderWithItems[];
  posMenu: ManualPosMenuBundle;
  canScanPackages?: boolean;
}) {
  const { orders, updateOrderFields, patchOrderLocal } = useRealtimeOrders(
    restaurantId,
    initialOrders,
    { activeOnly: false, channelName: `cashier-orders-${restaurantId}` }
  );
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [acceptBusyId, setAcceptBusyId] = useState<string | null>(null);
  const [posOpen, setPosOpen] = useState(false);
  /** Keep paid cards visible briefly so Confirm Payment doesn't yank the row away. */
  const [justPaidIds, setJustPaidIds] = useState<Record<string, true>>({});

  const awaitingAcceptance = useMemo(() => filterAwaitingAcceptance(orders), [orders]);

  const pendingOrders = useMemo(
    () =>
      [...orders]
        .filter((o) => needsCashierPaymentConfirmation(o) || justPaidIds[o.id])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders, justPaidIds]
  );

  const summary = useMemo(
    () => ({
      total: pendingOrders.length,
      awaitingCashier: pendingOrders.filter((o) => isAwaitingCashierConfirmation(o)).length,
      payAtEnd: pendingOrders.filter((o) => o.billing_model === "pay_after").length,
    }),
    [pendingOrders]
  );

  async function handleConfirmPayment(order: OrderWithItems) {
    setBusyOrderId(order.id);
    try {
      const fields: {
        payment_status: PaymentStatus;
        status?: OrderStatus;
        accepted_at?: string;
        accepted_by?: string;
      } = {
        payment_status: "paid",
      };
      // Pay-before: unlock to `new` after payment.
      if (order.status === "awaiting_payment") {
        fields.status = "new";
      }
      // Takeaway: payment at pickup / online proof = guest present — skip Accept.
      if (order.order_type === "takeaway" && !order.accepted_at) {
        fields.accepted_at = new Date().toISOString();
        fields.accepted_by = "Cashier (paid)";
      }

      const error = await updateOrderFields(order.id, fields);
      if (error) {
        toast.error(error.message);
        return;
      }
      setJustPaidIds((prev) => ({ ...prev, [order.id]: true }));
      window.setTimeout(() => {
        setJustPaidIds((prev) => {
          const next = { ...prev };
          delete next[order.id];
          return next;
        });
      }, 2500);
      toast.success("Payment confirmed");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleAcceptOrder(
    order: OrderWithItems,
    options?: { overrideDeynLimit?: boolean }
  ) {
    setAcceptBusyId(order.id);
    try {
      const res = await fetch(`/api/staff/orders/${order.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          override_deyn_limit: options?.overrideDeynLimit === true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadyAccepted?: boolean;
        code?: string;
        available?: number;
        needed?: number;
        customer_name?: string;
        can_override?: boolean;
        order?: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          payment_status?: string | null;
        };
      };
      if (!res.ok) {
        if (data.code === "deyn_limit" && data.can_override) {
          throw data;
        }
        toast.error(data.error || "Could not accept order");
        return;
      }
      if (data.order?.accepted_at) {
        patchOrderLocal(order.id, {
          accepted_at: data.order.accepted_at,
          accepted_by: data.order.accepted_by ?? null,
          ...(data.order.payment_status
            ? { payment_status: data.order.payment_status as OrderWithItems["payment_status"] }
            : {}),
        });
      }
      toast.success(
        data.alreadyAccepted
          ? `Already accepted by ${data.order?.accepted_by || "Staff"}`
          : "Order accepted — kitchen notified"
      );
    } finally {
      setAcceptBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AcceptOrdersQueue
        orders={awaitingAcceptance}
        busyOrderId={acceptBusyId}
        onAccept={handleAcceptOrder}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <header className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            Pending payment: {summary.total}
          </Badge>
          <Badge className="border-0 bg-amber-100 px-3 py-1 text-sm text-amber-900">
            Awaiting verify: {summary.awaitingCashier}
          </Badge>
          <Badge className="border-0 bg-slate-100 px-3 py-1 text-sm text-slate-700">
            Pay at end: {summary.payAtEnd}
          </Badge>
        </header>
        <Button type="button" onClick={() => setPosOpen(true)} className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          New order
        </Button>
      </div>

      <ManualPosDialog open={posOpen} onOpenChange={setPosOpen} menu={posMenu} />

      <LoyaltyLookupPanel slug={slug} />
      <PackagePassScanPanel enabled={canScanPackages} />

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1024px] text-sm">
            <thead>
              <tr className="border-b bg-[#F8FAFC] text-left text-[#64748B]">
                <th className="px-4 py-3 font-semibold">Order #</th>
                <th className="px-4 py-3 font-semibold">Table / Takeaway</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Payment Status</th>
                <th className="px-4 py-3 font-semibold">Order Status</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((order) => {
                const justPaid = Boolean(justPaidIds[order.id]);
                return (
                <tr
                  key={order.id}
                  className={cn(
                    "border-b last:border-0 transition-colors",
                    justPaid
                      ? "bg-emerald-50/90 dark:bg-emerald-950/40"
                      : "hover:bg-[#F8FAFC]/80 dark:hover:bg-white/5"
                  )}
                >
                  <td className="px-4 py-3 font-semibold text-[#0F172A] dark:text-foreground">
                    {formatOrderLabel(order, { prefix: false })}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#0F172A] dark:text-foreground">{formatLocation(order)}</td>
                  <td className="px-4 py-3 font-medium text-[#0F172A] dark:text-foreground">
                    {order.customer_phone ? (
                      <OrderCustomerPhone phone={order.customer_phone} variant="compact" className="text-sm font-semibold text-[#0F172A] dark:text-foreground" />
                    ) : (
                      <span className="text-sm text-[#94A3B8]">—</span>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-[#64748B] dark:text-muted-foreground">
                    <p className="line-clamp-2">{formatItems(order)}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0F172A] dark:text-foreground">
                    {formatCurrency(Number(order.total))}
                  </td>
                  <td className="px-4 py-3">
                    {justPaid ? (
                      <Badge className="border-0 bg-emerald-100 px-3 py-1 text-emerald-900">✅ Paid</Badge>
                    ) : (
                      (() => {
                        const paymentBadge = formatPaymentBadge(order);
                        return (
                          <Badge className={cn("border-0", paymentBadge.className)}>
                            {paymentBadge.label}
                          </Badge>
                        );
                      })()
                    )}
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
                    {justPaid ? (
                      <Badge className="border-0 bg-emerald-100 px-3 py-1 text-emerald-900">✅ Paid</Badge>
                    ) : (
                      <PaymentAction
                        order={order}
                        busy={busyOrderId === order.id}
                        onConfirmPayment={() => handleConfirmPayment(order)}
                      />
                    )}
                  </td>
                </tr>
              );
              })}
              {pendingOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-[#64748B]">
                    No pending payments — all caught up.
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
