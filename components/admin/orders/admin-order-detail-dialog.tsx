"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OrderCustomerPhone } from "@/components/staff/order-customer-phone";
import { isAwaitingCashierConfirmation } from "@/lib/payments/constants";
import { cn, formatCurrency, formatDate, formatOrderLabel } from "@/lib/utils";
import type { OrderStatus, OrderWithItems, UserRole } from "@/types/database";

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
  pending: "bg-slate-100 text-slate-700",
  pending_cashier_confirmation: "bg-amber-100 text-amber-900",
  failed: "bg-red-100 text-red-800",
};

const MANUAL_STATUSES: OrderStatus[] = [
  "awaiting_payment",
  "new",
  "preparing",
  "ready",
  "delivered",
  "completed",
  "cancelled",
];

const ACTION_ROLES: UserRole[] = ["owner", "manager", "cashier"];

function canAct(role: UserRole) {
  return ACTION_ROLES.includes(role);
}

function formatItemLine(item: OrderWithItems["order_items"][number]) {
  const name = item.menu_item?.name ?? "Item";
  const addOns =
    item.add_ons?.length > 0
      ? ` (+ ${item.add_ons.map((a) => a.name).join(", ")})`
      : "";
  return `${item.quantity}× ${name}${addOns}`;
}

export function AdminOrderDetailDialog({
  order,
  open,
  onOpenChange,
  restaurantId,
  actorRole,
  onOrderUpdated,
}: {
  order: OrderWithItems | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  actorRole: UserRole;
  onOrderUpdated: (patch: Partial<OrderWithItems> & { id: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [statusDraft, setStatusDraft] = useState<OrderStatus | "">("");

  if (!order) return null;

  const allowed = canAct(actorRole);
  const awaiting = isAwaitingCashierConfirmation(order);
  const isCancelled = order.status === "cancelled";

  async function runAction(
    action: "confirm_payment" | "cancel" | "update_status",
    extras?: { reason?: string; status?: OrderStatus }
  ) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${order!.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          restaurant_id: restaurantId,
          reason: extras?.reason,
          status: extras?.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Action failed");
      }
      if (data.order) {
        onOrderUpdated({
          id: order!.id,
          status: data.order.status,
          payment_status: data.order.payment_status,
          updated_at: data.order.updated_at,
        });
      }
      toast.success(
        action === "confirm_payment"
          ? "Payment confirmed"
          : action === "cancel"
            ? "Order cancelled"
            : "Status updated"
      );
      setShowCancel(false);
      setCancelReason("");
      setStatusDraft("");
      if (action === "cancel") onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-glass-panel max-w-lg border-0 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{formatOrderLabel(order, { prefix: true })}</DialogTitle>
          <DialogDescription>
            Placed {formatDate(order.created_at)}
            {order.updated_at && order.updated_at !== order.created_at
              ? ` · Updated ${formatDate(order.updated_at)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge
              className={cn(
                "border-0 capitalize",
                STATUS_CLASS[order.status] ?? "bg-slate-100"
              )}
            >
              {order.status.replaceAll("_", " ")}
            </Badge>
            <Badge
              className={cn(
                "border-0 capitalize",
                PAYMENT_CLASS[order.payment_status] ?? "bg-slate-100"
              )}
            >
              {order.payment_status.replaceAll("_", " ")}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium capitalize">{order.order_type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Table</dt>
              <dd className="font-medium">{order.table?.table_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium">{formatCurrency(Number(order.total))}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Method</dt>
              <dd className="font-medium uppercase">{order.payment_method ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Delivered by</dt>
              <dd className="font-medium">{order.delivered_by ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="mb-1 text-muted-foreground">Customer phone</dt>
              <dd>
                {order.customer_phone ? (
                  <OrderCustomerPhone phone={order.customer_phone} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>

          {order.notes?.trim() && (
            <div>
              <p className="text-muted-foreground">Order notes</p>
              <p className="mt-1 rounded-lg bg-muted/60 px-3 py-2">{order.notes}</p>
            </div>
          )}

          <div>
            <p className="mb-2 font-medium">Items</p>
            <ul className="space-y-2">
              {(order.order_items ?? []).map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{formatItemLine(item)}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatCurrency(Number(item.price_at_time) * item.quantity)}
                    </span>
                  </div>
                  {item.notes?.trim() && (
                    <p className="mt-1 text-xs text-muted-foreground">Note: {item.notes}</p>
                  )}
                </li>
              ))}
              {(order.order_items ?? []).length === 0 && (
                <li className="text-muted-foreground">No line items.</li>
              )}
            </ul>
          </div>

          {allowed && !isCancelled && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actions
              </p>

              {awaiting && (
                <Button
                  type="button"
                  disabled={busy}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => runAction("confirm_payment")}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm payment"}
                </Button>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={statusDraft || order.status}
                  onValueChange={(v) => setStatusDraft(v as OrderStatus)}
                  disabled={busy}
                >
                  <SelectTrigger className="sm:flex-1">
                    <SelectValue placeholder="Update status" />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_STATUSES.filter((s) => s !== "cancelled").map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !statusDraft || statusDraft === order.status}
                  onClick={() =>
                    statusDraft && runAction("update_status", { status: statusDraft })
                  }
                >
                  Update status
                </Button>
              </div>

              {!showCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-red-200 text-red-700 hover:bg-red-50"
                  disabled={busy}
                  onClick={() => setShowCancel(true)}
                >
                  Cancel / void order
                </Button>
              ) : (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3">
                  <Label htmlFor="cancel-reason">Reason (required, logged)</Label>
                  <Textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Customer left / duplicate / test order"
                    rows={3}
                    disabled={busy}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setShowCancel(false);
                        setCancelReason("");
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy || cancelReason.trim().length < 3}
                      onClick={() => runAction("cancel", { reason: cancelReason.trim() })}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm cancel"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!allowed && (
            <p className="text-xs text-muted-foreground">
              View only — confirm/cancel requires owner, manager, or cashier.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
