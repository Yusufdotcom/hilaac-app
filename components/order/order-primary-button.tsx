"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useAdminBrandColor } from "@/components/admin/admin-brand-context";
import {
  customerPlaceOrderButtonStyle,
  customerPrimaryButtonStyleFromAccent,
} from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";

type OrderButtonKind = "primary" | "place-order";

/**
 * Primary CTA for the customer order flow.
 * Safe outside OrderBrandProvider (Manual POS) — uses admin brand accent as fallback.
 */
export function OrderPrimaryButton({
  className,
  style,
  kind = "primary",
  ...props
}: ButtonProps & { kind?: OrderButtonKind }) {
  const orderBrand = useOrderBrandOptional();
  const adminAccent = useAdminBrandColor();

  const accent = orderBrand?.accent ?? adminAccent;
  const customBrandingActive = orderBrand?.customBrandingActive ?? true;
  const branding = orderBrand?.branding ?? {
    brand_color: accent,
    custom_branding_enabled: true,
  };

  const inlineStyle =
    kind === "place-order"
      ? customerPlaceOrderButtonStyle(branding)
      : customerPrimaryButtonStyleFromAccent(accent, customBrandingActive);

  return (
    <Button
      {...props}
      variant="brand"
      className={cn("border-0 transition-all duration-200 hover:opacity-90", className)}
      style={{ ...inlineStyle, ...style }}
    />
  );
}
