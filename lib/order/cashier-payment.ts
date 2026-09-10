import type { BillingModel, OrderStatus, OrderType, PaymentStatus } from "@/types/database";
import { isAwaitingCashierConfirmation } from "@/lib/payments/constants";

/**
 * When Cashier should show "Confirm Payment".
 *
 * - Already paid → never.
 * - Customer submitted USSD / provider → pending_cashier_confirmation (existing path).
 * - pay_after dine-in → after meal is delivered (or completed unpaid).
 * - Cash takeaway → at pickup when ready/delivered (or still awaiting_payment).
 * - EVC/eDahab takeaway already paid → never (auto-confirmed upstream).
 */
export function needsCashierPaymentConfirmation(order: {
  payment_status: PaymentStatus | string;
  payment_method?: string | null;
  order_type: OrderType | string;
  billing_model?: BillingModel | string | null;
  status: OrderStatus | string;
  customer_confirmed_at?: string | null;
}): boolean {
  if (order.payment_status === "paid") return false;
  if (order.status === "cancelled") return false;

  // Customer/provider already submitted — cashier must verify.
  if (isAwaitingCashierConfirmation(order)) return true;

  // pay_after dine-in: bill after delivery.
  if (
    order.billing_model === "pay_after" &&
    order.order_type === "dine-in" &&
    (order.status === "delivered" || order.status === "completed") &&
    order.payment_status === "pending"
  ) {
    return true;
  }

  // Cash takeaway: confirm at pickup (ready / delivered / still awaiting_payment).
  const method = (order.payment_method ?? "").toLowerCase();
  const isOnlineMethod = method === "evc" || method === "edahab";
  if (
    order.order_type === "takeaway" &&
    !isOnlineMethod &&
    order.payment_status === "pending" &&
    (order.status === "ready" ||
      order.status === "delivered" ||
      order.status === "awaiting_payment" ||
      order.status === "completed")
  ) {
    return true;
  }

  return false;
}
