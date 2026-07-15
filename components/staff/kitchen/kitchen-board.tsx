"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, ChefHat, Clock, Loader2, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { KitchenMenuAvailability } from "@/components/staff/kitchen/kitchen-menu-availability";
import type { OrderStatus, OrderWithItems, MenuItem } from "@/types/database";
import type { PostgrestError } from "@supabase/supabase-js";

const ACTIVE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];
const DELIVERED_STATUSES: OrderStatus[] = ["delivered", "completed"];

function isDeliveredStatus(status: string) {
  return DELIVERED_STATUSES.includes(status as OrderStatus);
}

function orderLabel(order: OrderWithItems) {
  if (order.order_type === "dine-in") {
    return `Table ${order.table?.table_number ?? "—"}`;
  }
  return `Takeaway #${order.id.slice(0, 6).toUpperCase()}`;
}

function statusBadge(status: OrderStatus) {
  if (status === "new") return { label: "New", className: "bg-blue-100 text-blue-800" };
  if (status === "preparing") return { label: "Preparing", className: "bg-amber-100 text-amber-900" };
  if (status === "ready") return { label: "Ready", className: "bg-emerald-100 text-emerald-900" };
  return { label: status, className: "bg-muted text-muted-foreground" };
}

function KitchenOrderCard({
  order,
  onStatusChange,
}: {
  order: OrderWithItems;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<PostgrestError | null>;
}) {
  const [pendingAction, setPendingAction] = useState<"preparing" | "ready" | null>(null);
  const [completedAction, setCompletedAction] = useState<"preparing" | "ready" | null>(null);

  const badge = statusBadge(order.status);
  const isBusy = pendingAction !== null;

  const preparingDone = order.status === "preparing" || order.status === "ready" || completedAction === "preparing";
  const readyDone = order.status === "ready" || completedAction === "ready";

  async function handleStatusChange(status: "preparing" | "ready") {
    if (isBusy) return;

    setPendingAction(status);
    setCompletedAction(null);

    const error = await onStatusChange(order.id, status);

    setPendingAction(null);

    if (error) {
      toast.error(error.message ?? "Could not update order status.");
      return;
    }

    setCompletedAction(status);
  }

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm",
        order.status === "new" && "border-l-4 border-l-blue-500",
        order.status === "preparing" && "border-l-4 border-l-amber-400",
        order.status === "ready" && "border-l-4 border-l-emerald-500"
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b bg-[#F8FAFC] px-4 py-3">
        <div className="flex items-center gap-2">
          {order.order_type === "dine-in" ? (
            <UtensilsCrossed className="h-5 w-5 text-[#0F172A]" aria-hidden="true" />
          ) : (
            <ShoppingBag className="h-5 w-5 text-[#0F172A]" aria-hidden="true" />
          )}
          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">{orderLabel(order)}</h3>
            <p className="flex items-center gap-1 text-xs text-[#64748B]">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDate(order.created_at)}
            </p>
          </div>
        </div>
        <Badge className={cn("shrink-0 border-0", badge.className)}>{badge.label}</Badge>
      </div>

      <div className="flex-1 space-y-3 px-4 py-4">
        <ul className="space-y-2">
          {order.order_items.map((item) => (
            <li key={item.id} className="text-sm">
              <p className="font-semibold text-[#0F172A]">
                {item.quantity}× {item.menu_item?.name ?? "Item"}
              </p>
              {item.add_ons?.length > 0 && (
                <p className="text-xs text-[#64748B]">+ {item.add_ons.map((a) => a.name).join(", ")}</p>
              )}
              {item.notes && (
                <p className="mt-0.5 text-xs italic text-[#64748B]">&ldquo;{item.notes}&rdquo;</p>
              )}
            </li>
          ))}
        </ul>

        {order.notes && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Special instructions</p>
            <p className="mt-1 text-sm text-amber-900">{order.notes}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t bg-[#F8FAFC] p-4">
        <Button
          type="button"
          className="h-11 rounded-xl bg-amber-400 font-semibold text-[#0F172A] hover:bg-amber-500 disabled:opacity-70"
          disabled={isBusy || preparingDone}
          onClick={() => handleStatusChange("preparing")}
        >
          {pendingAction === "preparing" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : preparingDone ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Preparing
            </>
          ) : (
            "Preparing"
          )}
        </Button>
        <Button
          type="button"
          className="h-11 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
          disabled={isBusy || readyDone}
          onClick={() => handleStatusChange("ready")}
        >
          {pendingAction === "ready" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : readyDone ? (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Ready
            </>
          ) : (
            "Ready"
          )}
        </Button>
      </div>
    </article>
  );
}

function DeliveredOrderCard({ order }: { order: OrderWithItems }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white opacity-90 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b bg-[#F8FAFC] px-4 py-3">
        <div className="flex items-center gap-2">
          {order.order_type === "dine-in" ? (
            <UtensilsCrossed className="h-5 w-5 text-[#64748B]" aria-hidden="true" />
          ) : (
            <ShoppingBag className="h-5 w-5 text-[#64748B]" aria-hidden="true" />
          )}
          <div>
            <h3 className="font-semibold text-[#0F172A]">{orderLabel(order)}</h3>
            <p className="flex items-center gap-1 text-xs text-[#64748B]">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDate(order.created_at)}
            </p>
          </div>
        </div>
        <Badge className="shrink-0 border-0 bg-blue-100 text-blue-900">Delivered</Badge>
      </div>
      <ul className="space-y-1 px-4 py-3 text-sm text-[#64748B]">
        {order.order_items.map((item) => (
          <li key={item.id}>
            {item.quantity}× {item.menu_item?.name ?? "Item"}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function KitchenBoard({
  restaurantId,
  restaurantName,
  initialOrders,
  initialDeliveredCount = 0,
  initialDeliveredOrders = [],
  initialMenuItems = [],
}: {
  restaurantId: string;
  restaurantName: string;
  initialOrders: OrderWithItems[];
  initialDeliveredCount?: number;
  initialDeliveredOrders?: OrderWithItems[];
  initialMenuItems?: MenuItem[];
}) {
  const [deliveredCount, setDeliveredCount] = useState(initialDeliveredCount);
  const [deliveredOrders, setDeliveredOrders] = useState<OrderWithItems[]>(initialDeliveredOrders);

  const handleOrderDelivered = useCallback((order: OrderWithItems, newStatus: string) => {
    if (!isDeliveredStatus(newStatus)) return;
    setDeliveredCount((count) => count + 1);
    setDeliveredOrders((prev) => {
      const next = [{ ...order, status: newStatus as OrderStatus }, ...prev.filter((o) => o.id !== order.id)];
      return next.slice(0, 12);
    });
  }, []);

  const { orders, updateOrderStatus } = useRealtimeOrders(restaurantId, initialOrders, {
    activeOnly: true,
    channelName: `kitchen-orders-${restaurantId}`,
    onOrderRemoved: handleOrderDelivered,
  });

  const activeOrders = useMemo(
    () =>
      orders
        .filter((o) => ACTIVE_STATUSES.includes(o.status))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  );

  const counts = useMemo(
    () => ({
      new: activeOrders.filter((o) => o.status === "new").length,
      preparing: activeOrders.filter((o) => o.status === "preparing").length,
      ready: activeOrders.filter((o) => o.status === "ready").length,
    }),
    [activeOrders]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F172A] text-[#D4A373]">
            <ChefHat className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Kitchen Dashboard</h1>
            <p className="text-sm text-[#64748B]">{restaurantName}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            New: {counts.new}
          </Badge>
          <Badge className="border-0 bg-amber-100 px-3 py-1 text-sm text-amber-900">
            Preparing: {counts.preparing}
          </Badge>
          <Badge className="border-0 bg-emerald-100 px-3 py-1 text-sm text-emerald-900">
            Ready: {counts.ready}
          </Badge>
          <Badge className="border-0 bg-blue-100 px-3 py-1 text-sm text-blue-900">
            Delivered: {deliveredCount}
          </Badge>
        </div>
      </header>

      {activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-20 text-center">
          <ChefHat className="mb-3 h-10 w-10 text-[#94A3B8]" aria-hidden="true" />
          <p className="text-lg font-semibold text-[#0F172A]">No active orders</p>
          <p className="mt-1 text-sm text-[#64748B]">New orders will appear here in real time.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeOrders.map((order) => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              onStatusChange={updateOrderStatus}
            />
          ))}
        </div>
      )}

      <KitchenMenuAvailability
        restaurantId={restaurantId}
        initialMenuItems={initialMenuItems}
      />

      {deliveredCount > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-[#0F172A]">Orders Delivered</h2>
            <Badge className="border-0 bg-blue-100 text-blue-900">{deliveredCount} today</Badge>
          </div>
          {deliveredOrders.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {deliveredOrders.map((order) => (
                <DeliveredOrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-white px-4 py-6 text-center text-sm text-[#64748B]">
              Delivered orders will appear here in real time.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
