"use client";

import { createContext, useContext, useMemo } from "react";
import {
  type RestaurantBranding,
  buildRestaurantBranding,
  HILAAC_NAVY,
  isCustomerBrandingActive,
  resolveCustomerAccent,
  SIDEBAR_TEXT_COLOR,
} from "@/lib/brand/restaurant-brand";

type OrderBrandContextValue = {
  branding: RestaurantBranding;
  /** Pre-resolved customer accent — brand_color or gold fallback. */
  accent: string;
  customBrandingActive: boolean;
};

const OrderBrandContext = createContext<OrderBrandContextValue | null>(null);

export function OrderBrandProvider({
  brandColor,
  customBrandingEnabled = false,
  accentColor,
  children,
}: {
  brandColor?: string | null;
  customBrandingEnabled?: boolean;
  /** Server-resolved accent passed from app/order/[slug]/page.tsx */
  accentColor?: string;
  children: React.ReactNode;
}) {
  const branding = useMemo(
    () => buildRestaurantBranding(brandColor, customBrandingEnabled),
    [brandColor, customBrandingEnabled]
  );
  const customBrandingActive = isCustomerBrandingActive(branding);
  const accent = accentColor ?? resolveCustomerAccent(branding);

  return (
    <OrderBrandContext.Provider value={{ branding, accent, customBrandingActive }}>
      <div
        className="flex h-[100dvh] min-h-0 flex-col"
        style={{
          ["--order-accent" as string]: accent,
          ["--brand-accent" as string]: accent,
          ["--brand-accent-foreground" as string]: customBrandingActive
            ? SIDEBAR_TEXT_COLOR
            : HILAAC_NAVY,
        }}
      >
        {children}
      </div>
    </OrderBrandContext.Provider>
  );
}

export function useOrderBrand() {
  const ctx = useContext(OrderBrandContext);
  if (!ctx) {
    throw new Error("useOrderBrand must be used within OrderBrandProvider");
  }
  return {
    restaurant: ctx.branding,
    branding: ctx.branding,
    accent: ctx.accent,
    customBrandingActive: ctx.customBrandingActive,
  };
}

export function useOrderBranding() {
  const ctx = useContext(OrderBrandContext);
  if (!ctx) {
    throw new Error("useOrderBranding must be used within OrderBrandProvider");
  }
  return ctx;
}

export function useOrderBrandOptional() {
  return useContext(OrderBrandContext);
}
