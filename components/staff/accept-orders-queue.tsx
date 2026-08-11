"use client";

import { CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderCustomerPhone } from "@/components/staff/order-customer-phone";
import { cn, formatOrderLabel } from "@/lib/utils";
import type { OrderWithItems } from "@/types/database";

function formatLocation(order: OrderWithItems) {
  if (order.order_type === "takeaway") return "Takeaway";
  return order.table?.table_number ? `Table ${order.table.table_number}` : "Table —";
}

function formatItems(order: OrderWithItems) {
  if (!order.order_items?.length) return "—";
  return order.order_items
    .map((item) => `${item.quantity}× ${item.menu_item?.name ?? "Item"}`)
    .join(", ");
}

export function AcceptOrdersQueue({
  orders,
  busyOrderId,
  onAccept,
}: {
  orders: OrderWithItems[];
  busyOrderId: string | null;
  onAccept: (order: OrderWithItems) => void;
}) {
  const count = orders.length;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm",
        count > 0
          ? "border-amber-300 bg-amber-50/80 ring-1 ring-amber-200"
          : "border-[#E2E8F0] bg-white"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-amber-200/80 px-4 py-3 sm:px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-[#0F172A]">Needs acceptance</h2>
          <p className="text-xs text-[#64748B]">
            Confirm the guest is present before kitchen starts cooking.
          </p>
        </div>
        <Badge
          className={cn(
            "border-0 px-3 py-1 text-sm font-semibold",
            count > 0 ? "bg-amber-200 text-amber-950" : "bg-slate-100 text-slate-600"
          )}
        >
          {count} waiting
        </Badge>
      </div>

      {count === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[#64748B] sm:px-5">
          No orders waiting for acceptance.
        </p>
      ) : (
        <ul className="divide-y divide-amber-200/70">
          {orders.map((order) => {
            const busy = busyOrderId === order.id;
            const accepted = Boolean(order.accepted_at);

            return (
              <li
                key={order.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold text-[#0F172A]">
                      {formatOrderLabel(order)}
                    </p>
                    <Badge className="border-0 bg-white text-[#0F172A]">
                      {formatLocation(order)}
                    </Badge>
                  </div>
                  <OrderCustomerPhone
                    phone={order.customer_phone}
                    variant="compact"
                    className="text-sm font-medium text-[#0F172A]"
                  />
                  <p className="line-clamp-2 text-sm text-[#64748B]">{formatItems(order)}</p>
                </div>

                <div className="shrink-0">
                  {accepted ? (
                    <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Accepted by {order.accepted_by || "Staff"}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => onAccept(order)}
                      className="h-11 w-full rounded-xl bg-[#0F172A] px-5 font-semibold text-white hover:bg-[#1E293B] sm:w-auto"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        "Accept order"
                      )}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
