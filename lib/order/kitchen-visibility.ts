import type { OrderStatus, PaymentStatus } from "@/types/database";

const KITCHEN_ACTIVE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

/**
 * Kitchen only cooks orders after the cashier marks payment as paid.
 * Orders in pending_cashier_confirmation (or any other unpaid state) are hidden.
 */
export function isKitchenVisible(order: {
  status: OrderStatus;
  payment_status: PaymentStatus;
}) {
  if (order.status === "awaiting_payment") return false;
  if (!KITCHEN_ACTIVE_STATUSES.includes(order.status)) return false;
  return order.payment_status === "paid";
}

export function filterKitchenOrders<
  T extends {
    status: OrderStatus;
    payment_status: PaymentStatus;
  },
>(orders: T[]) {
  return orders.filter(isKitchenVisible);
}
