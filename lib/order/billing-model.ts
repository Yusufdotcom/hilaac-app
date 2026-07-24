import type { BillingModel, OrderType, OrderStatus, PaymentStatus } from "@/types/database";
import { isAwaitingCashierConfirmation } from "@/lib/payments/constants";

export function billingModelForOrderType(
  orderType: OrderType,
  restaurant: {
    billing_model_dinein?: BillingModel | null;
    billing_model_takeaway?: BillingModel | null;
  }
): BillingModel {
  const model =
    orderType === "dine-in" ? restaurant.billing_model_dinein : restaurant.billing_model_takeaway;
  return model ?? "pay_before";
}

export function payAfterMessage(orderType: OrderType) {
  if (orderType === "takeaway") {
    return "You can pay when you collect your order.";
  }
  return "Bill will be brought to you after your meal.";
}

export function customerStatusWorkflowMessage(order: {
  billing_model?: BillingModel | null;
  payment_status: PaymentStatus;
  status: OrderStatus;
}) {
  if (order.status === "delivered" || order.status === "completed") {
    return "Receipt ka waxa ku keenaya waiter ka. Mahadsanid!";
  }

  if (order.billing_model === "pay_after") {
    return "Your meal is being prepared. Ask the cashier for your bill when you are ready to pay.";
  }

  if (
    order.billing_model === "pay_before" ||
    order.status === "awaiting_payment"
  ) {
    if (
      order.payment_status !== "paid" &&
      (isAwaitingCashierConfirmation(order) ||
        order.status === "awaiting_payment" ||
        order.payment_status === "pending")
    ) {
      return "Waiting for cashier to confirm your payment before the kitchen starts cooking.";
    }
  }

  return null;
}
