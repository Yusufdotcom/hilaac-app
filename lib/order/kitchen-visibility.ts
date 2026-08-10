import type { BillingModel, OrderStatus, PaymentStatus } from "@/types/database";

const KITCHEN_ACTIVE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

/**
 * Kitchen ticket visibility — same rules for new / preparing / ready (no per-status split).
 *
 * - pay_before: kitchen only after cashier marks payment paid (and not awaiting_payment).
 * - pay_after: kitchen starts immediately; payment is collected after the meal.
 * - cancelled / awaiting_payment: never shown.
 */
export function isKitchenVisible(order: {
  status: OrderStatus;
  payment_status: PaymentStatus;
  billing_model?: BillingModel | null;
}) {
  if (order.status === "awaiting_payment" || order.status === "cancelled") return false;
  if (!KITCHEN_ACTIVE_STATUSES.includes(order.status)) return false;

  if (order.billing_model === "pay_after") return true;

  return order.payment_status === "paid";
}

export function filterKitchenOrders<
  T extends {
    status: OrderStatus;
    payment_status: PaymentStatus;
    billing_model?: BillingModel | null;
  },
>(orders: T[]) {
  return orders.filter(isKitchenVisible);
}
