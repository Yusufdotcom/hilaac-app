import type { OrderStatus } from "@/types/database";

const KITCHEN_ACTIVE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

/**
 * Kitchen ticket visibility — acceptance gate only.
 * Payment confirmation is fully independent (especially pay_after).
 */
export function isKitchenVisible(order: {
  status: OrderStatus;
  accepted_at?: string | null;
}) {
  if (order.status === "awaiting_payment" || order.status === "cancelled") return false;
  if (!KITCHEN_ACTIVE_STATUSES.includes(order.status)) return false;
  return Boolean(order.accepted_at);
}

export function filterKitchenOrders<
  T extends {
    status: OrderStatus;
    accepted_at?: string | null;
  },
>(orders: T[]) {
  return orders.filter(isKitchenVisible);
}
