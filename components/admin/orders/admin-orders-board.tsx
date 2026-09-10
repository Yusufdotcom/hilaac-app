"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { AdminOrderDetailDialog } from "@/components/admin/orders/admin-order-detail-dialog";
import {
  ManualPosDialog,
  type ManualPosMenuBundle,
} from "@/components/admin/orders/manual-pos-dialog";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { cn, formatCurrency, formatDate, formatOrderLabel } from "@/lib/utils";
import type { OrderWithItems, UserRole } from "@/types/database";

const STATUS_CLASS: Record<string, string> = {
  awaiting_payment: "bg-orange-100 text-orange-900",
  new: "bg-blue-100 text-blue-800",
  preparing: "bg-amber-100 text-amber-900",
  ready: "bg-emerald-100 text-emerald-900",
  delivered: "bg-violet-100 text-violet-900",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-red-100 text-red-800",
};

const PAYMENT_CLASS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-900",
  pending: "bg-[var(--admin-subtle)] text-[var(--admin-text)]",
  pending_cashier_confirmation: "bg-amber-100 text-amber-900",
  failed: "bg-red-100 text-red-800",
};

function secondarySummary(order: OrderWithItems) {
  const parts = [
    order.order_type === "takeaway" ? "Takeaway" : `Table ${order.table?.table_number ?? "—"}`,
    order.payment_status.replaceAll("_", " "),
    order.payment_method ? order.payment_method.toUpperCase() : null,
    order.delivered_by ? `by ${order.delivered_by}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function AdminOrdersBoard({
  restaurantId,
  initialOrders,
  actorRole,
  posMenu,
}: {
  restaurantId: string;
  initialOrders: OrderWithItems[];
  actorRole: UserRole;
  posMenu: ManualPosMenuBundle;
}) {
  const { orders, patchOrderLocal } = useRealtimeOrders(restaurantId, initialOrders, {
    activeOnly: false,
    channelName: `admin-orders-${restaurantId}`,
    sortNewestFirst: true,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posOpen, setPosOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [orders]
  );

  const selected = sorted.find((o) => o.id === selectedId) ?? null;

  function handleOrderUpdated(patch: Partial<OrderWithItems> & { id: string }) {
    patchOrderLocal(patch.id, {
      status: patch.status,
      payment_status: patch.payment_status,
      updated_at: patch.updated_at,
    });
  }

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-5">
      <AdminPageIntro
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => setPosOpen(true)}>
              <Plus className="h-4 w-4" />
              New order
            </Button>
            <Badge className="border-0 bg-emerald-50 px-3 py-1 text-emerald-800">Live</Badge>
          </div>
        }
      >
        Tap a row for details and actions. Updates live — no refresh needed.
      </AdminPageIntro>

      <ManualPosDialog open={posOpen} onOpenChange={setPosOpen} menu={posMenu} />

      <Card className="admin-glass-hover w-full min-w-0 overflow-hidden border-[var(--admin-border,#E2E8F0)]">
        <CardContent className="p-0">
          {/* Mobile / tablet cards */}
          <ul className="divide-y md:hidden">
            {sorted.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(order.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {formatOrderLabel(order, { prefix: false })}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(Number(order.total))}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(
                          "max-w-[9rem] truncate border-0 capitalize",
                          STATUS_CLASS[order.status] ?? "bg-[var(--admin-subtle)]"
                        )}
                      >
                        {order.status.replaceAll("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground capitalize">
                      {secondarySummary(order)}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
            {sorted.length === 0 && (
              <li className="p-8 text-center text-muted-foreground">No orders yet.</li>
            )}
          </ul>

          {/* Desktop: priority columns only — no horizontal scroll */}
          <div className="hidden md:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="w-[18%] p-3 font-medium lg:p-4">Order</th>
                  <th className="w-[22%] p-3 font-medium lg:p-4">Status</th>
                  <th className="w-[16%] p-3 font-medium lg:p-4">Total</th>
                  <th className="w-[28%] p-3 font-medium lg:p-4">Placed</th>
                  <th className="w-[16%] p-3 font-medium lg:p-4">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() => setSelectedId(order.id)}
                  >
                    <td className="truncate p-3 font-semibold lg:p-4">
                      {formatOrderLabel(order, { prefix: false })}
                      <p className="mt-0.5 truncate text-xs font-normal capitalize text-muted-foreground">
                        {order.order_type === "takeaway"
                          ? "Takeaway"
                          : `Table ${order.table?.table_number ?? "—"}`}
                        {" · "}
                        {order.payment_status.replaceAll("_", " ")}
                      </p>
                    </td>
                    <td className="p-3 lg:p-4">
                      <Badge
                        className={cn(
                          "max-w-full truncate border-0 capitalize",
                          STATUS_CLASS[order.status] ?? "bg-[var(--admin-subtle)]"
                        )}
                      >
                        {order.status.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-3 font-medium tabular-nums lg:p-4">
                      {formatCurrency(Number(order.total))}
                    </td>
                    <td className="truncate p-3 text-muted-foreground lg:p-4">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="p-3 text-right lg:p-4">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AdminOrderDetailDialog
        order={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        restaurantId={restaurantId}
        actorRole={actorRole}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
}
