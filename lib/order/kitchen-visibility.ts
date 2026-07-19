import type { BillingModel, OrderStatus, PaymentStatus } from "@/types/database";
import { PENDING_CASHIER_CONFIRMATION } from "@/lib/payments/constants";

const KITCHEN_ACTIVE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

/**
 * Kitchen only cooks orders with cashier-verified payment (paid).
 * Pay-at-end orders proceed while still unpaid (pending); once the customer
 * pays, the order moves to pending_cashier_confirmation until the cashier
 * verifies and marks it paid.
 */
export function isKitchenVisible(order: {
  status: OrderStatus;
  payment_status: PaymentStatus;
  billing_model?: BillingModel | null;
}) {
  if (order.status === "awaiting_payment") return false;
  if (!KITCHEN_ACTIVE_STATUSES.includes(order.status)) return false;
  if (order.payment_status === PENDING_CASHIER_CONFIRMATION) return false;

  if (order.billing_model === "pay_after" && order.payment_status === "pending") {
    return true;
  }

  return order.payment_status === "paid";
}

export function filterKitchenOrders<T extends {
  status: OrderStatus;
  payment_status: PaymentStatus;
  billing_model?: BillingModel | null;
}>(orders: T[]) {
  return orders.filter(isKitchenVisible);
}
