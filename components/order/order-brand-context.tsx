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
  accent: string;
  customBrandingActive: boolean;
};

const OrderBrandContext = createContext<OrderBrandContextValue | null>(null);

export function OrderBrandProvider({
  brandColor,
  customBrandingEnabled = false,
  children,
}: {
  brandColor?: string | null;
  customBrandingEnabled?: boolean;
  children: React.ReactNode;
}) {
  const branding = useMemo(
    () => buildRestaurantBranding(brandColor, customBrandingEnabled),
    [brandColor, customBrandingEnabled]
  );
  const accent = resolveCustomerAccent(branding);
  const customBrandingActive = isCustomerBrandingActive(branding);

  return (
    <OrderBrandContext.Provider value={{ branding, accent, customBrandingActive }}>
      <div
        className="contents"
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

/** @deprecated Use `useOrderBranding` — kept for gradual migration inside order components. */
export function useOrderBrand() {
  const ctx = useContext(OrderBrandContext);
  if (!ctx) {
    throw new Error("useOrderBrand must be used within OrderBrandProvider");
  }
  return {
    restaurant: ctx.branding,
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
