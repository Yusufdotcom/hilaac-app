import type { BillingModel, OrderType } from "@/types/database";

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
