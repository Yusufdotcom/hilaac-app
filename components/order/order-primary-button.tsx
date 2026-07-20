"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  customerPaymentButtonStyle,
  customerPlaceOrderButtonStyle,
  customerPrimaryButtonStyle,
} from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";
import { useOrderBrand } from "@/components/order/order-brand-context";

type OrderButtonKind = "primary" | "place-order" | "payment-evc" | "payment-edahab";

const DEFAULT_PAYMENT_CLASS: Record<"payment-evc" | "payment-edahab", string> = {
  "payment-evc": "bg-emerald-600 text-white hover:bg-emerald-700",
  "payment-edahab": "bg-amber-500 text-white hover:bg-amber-600",
};

export function OrderPrimaryButton({
  className,
  style,
  kind = "primary",
  ...props
}: ButtonProps & { kind?: OrderButtonKind }) {
  const { restaurant, customBrandingActive } = useOrderBrand();

  let inlineStyle: React.CSSProperties | undefined;
  let defaultClass: string | undefined;

  switch (kind) {
    case "place-order":
      inlineStyle = customerPlaceOrderButtonStyle(restaurant);
      break;
    case "payment-evc":
    case "payment-edahab":
      inlineStyle = customerPaymentButtonStyle(restaurant);
      if (!customBrandingActive) {
        defaultClass = DEFAULT_PAYMENT_CLASS[kind];
      }
      break;
    default:
      inlineStyle = customerPrimaryButtonStyle(restaurant);
  }

  return (
    <Button
      {...props}
      variant="brand"
      className={cn(
        "border-0 hover:opacity-90",
        customBrandingActive && "text-white",
        defaultClass,
        className
      )}
      style={{ ...inlineStyle, ...style }}
    />
  );
}
