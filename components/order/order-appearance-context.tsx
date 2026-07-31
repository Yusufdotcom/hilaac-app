"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type OrderTheme,
  readStoredOrderTheme,
  systemPrefersDark,
  writeStoredOrderTheme,
} from "@/lib/order/appearance";
type OrderAppearanceContextValue = {
  theme: OrderTheme;
  setTheme: (theme: OrderTheme) => void;
  toggleTheme: () => void;
  /** Apply to any portaled surface (sheets/modals) so tokens follow the order theme. */
  surfaceProps: {
    className: string;
    "data-order-theme": OrderTheme;
  };
};

const OrderAppearanceContext = createContext<OrderAppearanceContextValue | null>(null);

export function OrderAppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<OrderTheme>("light");

  useEffect(() => {
    const stored = readStoredOrderTheme();
    setThemeState(stored ?? (systemPrefersDark() ? "dark" : "light"));
  }, []);

  const setTheme = useCallback((next: OrderTheme) => {
    setThemeState(next);
    writeStoredOrderTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      writeStoredOrderTheme(next);
      return next;
    });
  }, []);

  const value = useMemo<OrderAppearanceContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      surfaceProps: {
        className: "order-flow-surface",
        "data-order-theme": theme,
      },
    }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <OrderAppearanceContext.Provider value={value}>
      <div
        className="order-flow flex min-h-0 w-full flex-1 flex-col"
        data-order-theme={theme}
      >
        {children}
      </div>
    </OrderAppearanceContext.Provider>
  );
}

export function useOrderAppearance() {
  const ctx = useContext(OrderAppearanceContext);
  if (!ctx) {
    throw new Error("useOrderAppearance must be used within OrderAppearanceProvider");
  }
  return ctx;
}

export function useOrderAppearanceOptional() {
  return useContext(OrderAppearanceContext);
}
