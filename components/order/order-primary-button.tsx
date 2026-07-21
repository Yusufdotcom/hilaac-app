"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  customerPaymentButtonStyle,
  customerPlaceOrderButtonStyle,
  customerPrimaryButtonStyle,
  isCustomerBrandingActive,
} from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";
import { useOrderBrand } from "@/components/order/order-brand-context";

type OrderButtonKind = "primary" | "place-order" | "payment-evc" | "payment-edahab";

function styleForKind(
  restaurant: Parameters<typeof customerPrimaryButtonStyle>[0],
  kind: OrderButtonKind
) {
  switch (kind) {
    case "place-order":
      return customerPlaceOrderButtonStyle(restaurant);
    case "payment-evc":
    case "payment-edahab":
      return customerPaymentButtonStyle(restaurant);
    default:
      return customerPrimaryButtonStyle(restaurant);
  }
}

export function OrderPrimaryButton({
  className,
  style,
  kind = "primary",
  ...props
}: ButtonProps & { kind?: OrderButtonKind }) {
  const { restaurant } = useOrderBrand();
  const inlineStyle = styleForKind(restaurant, kind);
  const customBrandingActive = isCustomerBrandingActive(restaurant);

  return (
    <Button
      {...props}
      variant="brand"
      className={cn(
        "border-0 transition-all duration-200 hover:opacity-90",
        customBrandingActive && "text-white",
        className
      )}
      style={{ ...inlineStyle, ...style }}
    />
  );
}
