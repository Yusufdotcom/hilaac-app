"use client";

import { createContext, useContext } from "react";
import {
  type CustomerBrandingRestaurant,
  isCustomerBrandingActive,
  resolveCustomerAccent,
} from "@/lib/brand/restaurant-brand";

type OrderBrandContextValue = {
  restaurant: CustomerBrandingRestaurant;
  accent: string;
  customBrandingActive: boolean;
};

const OrderBrandContext = createContext<OrderBrandContextValue | null>(null);

export function OrderBrandProvider({
  restaurant,
  children,
}: {
  restaurant: CustomerBrandingRestaurant;
  children: React.ReactNode;
}) {
  const accent = resolveCustomerAccent(restaurant);
  const customBrandingActive = isCustomerBrandingActive(restaurant);

  return (
    <OrderBrandContext.Provider value={{ restaurant, accent, customBrandingActive }}>
      <div className="contents" style={{ ["--order-accent" as string]: accent }}>
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
  return ctx;
}

/** Safe fallback when provider is not mounted (e.g. legacy pages). */
export function useOrderBrandOptional() {
  return useContext(OrderBrandContext);
}
