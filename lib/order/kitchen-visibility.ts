import type { BillingModel, OrderStatus, PaymentStatus } from "@/types/database";

const KITCHEN_ACTIVE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

/**
 * Kitchen ticket visibility.
 *
 * Flow summary:
 * - Accept queue (Cashier/Waiter): guest presence — required for dine-in QR orders.
 * - Kitchen: only after Accept (`accepted_at`), never for cancelled/delivered/completed.
 * - pay_before: also require `payment_status = paid` (EVC/eDahab or cashier cash).
 * - pay_after dine-in: kitchen cooks before payment; Confirm Payment is after delivery.
 * - Manual POS: create path sets `accepted_at` immediately → kitchen sees it at once.
 * - Paid takeaway (EVC/eDahab): Accept is skipped by auto-setting `accepted_at` on pay.
 */
export function isKitchenVisible(order: {
  status: OrderStatus;
  accepted_at?: string | null;
  payment_status?: PaymentStatus | string | null;
  billing_model?: BillingModel | string | null;
}) {
  if (order.status === "cancelled") return false;
  if (order.status === "delivered") return false;
  if (order.status === "completed") return false;
  if (order.status === "awaiting_payment") return false;
  if (!KITCHEN_ACTIVE_STATUSES.includes(order.status)) return false;

  // Guest must be confirmed present (or POS / paid-takeaway auto-accept).
  if (!order.accepted_at) return false;

  // pay_before: do not cook until money is confirmed.
  if (order.billing_model === "pay_before" && order.payment_status !== "paid") {
    return false;
  }

  return true;
}

export function filterKitchenOrders<
  T extends {
    status: OrderStatus;
    accepted_at?: string | null;
    payment_status?: PaymentStatus | string | null;
    billing_model?: BillingModel | string | null;
  },
>(orders: T[]) {
  return orders.filter(isKitchenVisible);
}
