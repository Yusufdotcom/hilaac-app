"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  customerPlaceOrderButtonStyle,
  customerPrimaryButtonStyleFromAccent,
} from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";
import { useOrderBrand } from "@/components/order/order-brand-context";

type OrderButtonKind = "primary" | "place-order";

export function OrderPrimaryButton({
  className,
  style,
  kind = "primary",
  ...props
}: ButtonProps & { kind?: OrderButtonKind }) {
  const { branding, accent, customBrandingActive } = useOrderBrand();

  const inlineStyle =
    kind === "place-order"
      ? customerPlaceOrderButtonStyle(branding)
      : customerPrimaryButtonStyleFromAccent(accent, customBrandingActive);

  return (
    <Button
      {...props}
      variant="brand"
      className={cn(
        "border-0 transition-all duration-200 hover:opacity-90",
        className
      )}
      style={{ ...inlineStyle, ...style }}
    />
  );
}
