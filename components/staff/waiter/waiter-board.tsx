"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  PackageCheck,
  ShoppingBag,
  UtensilsCrossed,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatOrderLabel } from "@/lib/utils";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { useStaffOrderNotifications } from "@/lib/hooks/use-staff-order-notifications";
import type { OrderStatus, OrderWithItems, RestaurantTable, Waiter } from "@/types/database";

const ACTIVE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

function orderRecency(order: OrderWithItems) {
  return new Date(order.updated_at).getTime();
}

function statusMeta(status: OrderStatus | "free") {
  switch (status) {
    case "new":
      return { label: "New", className: "bg-blue-100 text-blue-800" };
    case "preparing":
      return { label: "Preparing", className: "bg-amber-100 text-amber-900" };
    case "ready":
      return { label: "Ready", className: "bg-emerald-100 text-emerald-900" };
    default:
      return { label: "Free", className: "bg-slate-100 text-slate-600" };
  }
}

function sortTables(tables: RestaurantTable[]) {
  return [...tables].sort((a, b) => {
    const numA = Number.parseInt(a.table_number, 10);
    const numB = Number.parseInt(b.table_number, 10);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
    return a.table_number.localeCompare(b.table_number);
  });
}

function DeliveredButton({
  busy,
  disabled,
  onClick,
}: {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      disabled={busy || disabled}
      className="mt-4 h-10 w-full rounded-xl bg-[#0F172A] font-semibold text-white hover:bg-[#1E293B] disabled:opacity-70"
      onClick={onClick}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      Delivered
    </Button>
  );
}

export function WaiterBoard({
  restaurantId,
  restaurantName,
  tables,
  initialOrders,
  waiters,
  initialDeliveryCounts = {},
}: {
  restaurantId: string;
  restaurantName: string;
  tables: RestaurantTable[];
  initialOrders: OrderWithItems[];
  waiters: Waiter[];
  initialDeliveryCounts?: Record<string, number>;
}) {
  const { alertNewOrder, syncPendingBadge } = useStaffOrderNotifications(
    "Waiter Dashboard",
    restaurantName
  );

  const { orders, removeOrder, restoreOrder, updateOrderFields } = useRealtimeOrders(
    restaurantId,
    initialOrders,
    {
      activeOnly: true,
      channelName: `waiter-orders-${restaurantId}`,
      pinReadyToTop: true,
      sortNewestFirst: true,
      onNewOrder: alertNewOrder,
    }
  );

  useEffect(() => {
    syncPendingBadge(orders);
  }, [orders, syncPendingBadge]);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [selectedWaiter, setSelectedWaiter] = useState("");
  const [deliveryCounts, setDeliveryCounts] = useState<Record<string, number>>(initialDeliveryCounts);

  const deliveriesToday = selectedWaiter ? (deliveryCounts[selectedWaiter] ?? 0) : 0;

  const activeDineIn = useMemo(
    () => orders.filter((o) => o.order_type === "dine-in" && ACTIVE_STATUSES.includes(o.status)),
    [orders]
  );

  const readyTakeaway = useMemo(
    () =>
      orders
        .filter((o) => o.order_type === "takeaway" && o.status === "ready")
        .sort((a, b) => orderRecency(b) - orderRecency(a)),
    [orders]
  );

  const tableRows = useMemo(() => {
    const rows = sortTables(tables).map((table) => {
      const order =
        activeDineIn
          .filter((o) => o.table_id === table.id)
          .sort((a, b) => orderRecency(b) - orderRecency(a))[0] ?? null;

      const status = order?.status ?? "free";
      return { table, order, status: status as OrderStatus | "free" };
    });

    return rows.sort((a, b) => {
      const aReady = a.status === "ready" ? 1 : 0;
      const bReady = b.status === "ready" ? 1 : 0;
      if (aReady !== bReady) return bReady - aReady;

      if (a.status === "ready" && b.status === "ready" && a.order && b.order) {
        return orderRecency(b.order) - orderRecency(a.order);
      }

      return 0;
    });
  }, [tables, activeDineIn]);

  async function markDelivered(orderId: string) {
    if (!selectedWaiter) {
      toast.error("Select who is delivering before marking an order as delivered.");
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    removeOrder(orderId);
    setBusyOrderId(orderId);

    try {
      const error = await updateOrderFields(orderId, {
        status: "completed",
        delivered_by: selectedWaiter,
      });
      if (error) {
        restoreOrder(order);
        toast.error(error.message);
        return;
      }

      setDeliveryCounts((prev) => ({
        ...prev,
        [selectedWaiter]: (prev[selectedWaiter] ?? 0) + 1,
      }));
      toast.success("Order completed successfully.");
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F172A] text-[#D4A373]">
            <UserRound className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Waiter Dashboard</h1>
            <p className="text-sm text-[#64748B]">{restaurantName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <PackageCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">My deliveries</p>
            <p className="text-lg font-bold text-[#0F172A]">
              Deliveries today: {deliveriesToday}
            </p>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
        <Label htmlFor="delivering-waiter" className="text-sm font-semibold text-[#0F172A]">
          Who is delivering?
        </Label>
        {waiters.length === 0 ? (
          <p className="mt-2 text-sm text-[#64748B]">
            No waiters configured yet. Ask your manager to add waiter names in the Admin Dashboard.
          </p>
        ) : (
          <Select value={selectedWaiter} onValueChange={setSelectedWaiter}>
            <SelectTrigger id="delivering-waiter" className="mt-2 h-12 rounded-xl">
              <SelectValue placeholder="Select your name" />
            </SelectTrigger>
            <SelectContent>
              {waiters.map((waiter) => (
                <SelectItem key={waiter.id} value={waiter.name}>
                  {waiter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-[#0F172A]" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-[#0F172A]">Tables</h2>
          <Badge variant="secondary" className="text-xs">
            Ready orders shown first
          </Badge>
        </div>

        {tableRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-white px-4 py-10 text-center text-[#64748B]">
            No tables configured for this restaurant.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tableRows.map(({ table, order, status }) => {
              const meta = statusMeta(status);
              return (
                <article
                  key={table.id}
                  className={cn(
                    "flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition-opacity duration-200",
                    status === "ready" && "border-emerald-300 ring-1 ring-emerald-200",
                    status === "free" && "border-[#E2E8F0]"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#64748B]">Table</p>
                      <p className="text-2xl font-bold text-[#0F172A]">{table.table_number}</p>
                    </div>
                    <Badge className={cn("border-0 capitalize", meta.className)}>{meta.label}</Badge>
                  </div>

                  {order && (
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                      {formatOrderLabel(order)}
                    </p>
                  )}

                  {order && (
                    <p className="mt-1 line-clamp-2 text-sm text-[#64748B]">
                      {order.order_items
                        .map((item) => `${item.quantity}× ${item.menu_item?.name ?? "Item"}`)
                        .join(", ")}
                    </p>
                  )}

                  {order?.status === "ready" ? (
                    <DeliveredButton
                      busy={busyOrderId === order.id}
                      disabled={!selectedWaiter}
                      onClick={() => markDelivered(order.id)}
                    />
                  ) : (
                    <p className="mt-4 text-xs text-[#94A3B8]">
                      {status === "free" ? "Available for guests" : "Waiting on kitchen…"}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-[#0F172A]" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-[#0F172A]">Takeaway — ready for pickup</h2>
        </div>

        {readyTakeaway.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-white px-4 py-10 text-center text-[#64748B]">
            No takeaway orders ready for pickup.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {readyTakeaway.map((order) => (
              <article
                key={order.id}
                className="flex flex-col rounded-2xl border border-emerald-300 bg-white p-4 shadow-sm ring-1 ring-emerald-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold text-[#0F172A]">{formatOrderLabel(order)}</p>
                    <p className="text-sm font-medium text-[#64748B]">Takeaway</p>
                  </div>
                  <Badge className="border-0 bg-emerald-100 text-emerald-900">Ready</Badge>
                </div>

                <ul className="mt-3 space-y-1 text-sm text-[#0F172A]">
                  {order.order_items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.menu_item?.name ?? "Item"}
                    </li>
                  ))}
                </ul>

                {order.notes && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {order.notes}
                  </p>
                )}

                <DeliveredButton
                  busy={busyOrderId === order.id}
                  disabled={!selectedWaiter}
                  onClick={() => markDelivered(order.id)}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
