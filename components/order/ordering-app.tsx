"use client";

import { useMemo, useState } from "react";
import type { AddOn, Category, MenuItem, RestaurantTable } from "@/types/database";
import type { CartItem } from "@/lib/order/cart-types";
import { LandingStep } from "@/components/order/landing-step";
import { TableStep } from "@/components/order/table-step";
import { MenuStep } from "@/components/order/menu-step";
import { CartSheet } from "@/components/order/cart-sheet";
import { ItemCustomizeSheet } from "@/components/order/item-customize-sheet";
import { OrderConfirmation } from "@/components/order/order-confirmation";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";

type Step = "landing" | "table" | "menu" | "confirmation";
type OrderType = "dine-in" | "takeaway";

interface MinimalRestaurant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  payment_mode: "ussd" | "api";
  evc_ussd_code: string | null;
  edahab_ussd_code: string | null;
  dine_in_enabled: boolean;
  takeaway_enabled: boolean;
}

export function OrderingApp({
  restaurant,
  categories,
  menuItems,
  addOns,
  tables,
}: {
  restaurant: MinimalRestaurant;
  categories: Category[];
  menuItems: MenuItem[];
  addOns: AddOn[];
  tables: RestaurantTable[];
}) {
  const [step, setStep] = useState<Step>("landing");
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [tableNumber, setTableNumber] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const topPicks = useMemo(() => menuItems.filter((m) => m.is_top_pick), [menuItems]);

  function handleSelectOrderType(type: OrderType) {
    setOrderType(type);
    if (type === "dine-in") {
      setStep("table");
    } else {
      setStep("menu");
    }
  }

  function handleTableConfirmed(number: string) {
    setTableNumber(number);
    setStep("menu");
  }

  function handleAddToCart(item: CartItem) {
    setCart((prev) => [...prev, item]);
    setCustomizeItem(null);
  }

  function handleUpdateCartItem(cartId: string, updates: Partial<CartItem>) {
    setCart((prev) => prev.map((i) => (i.cartId === cartId ? { ...i, ...updates } : i)));
  }

  function handleRemoveCartItem(cartId: string) {
    setCart((prev) => prev.filter((i) => i.cartId !== cartId));
  }

  function handleOrderPlaced(orderId: string) {
    setPlacedOrderId(orderId);
    setCart([]);
    setCartOpen(false);
    setStep("confirmation");
  }

  function handleNewOrder() {
    setPlacedOrderId(null);
    setStep("landing");
  }

  if (step === "confirmation" && placedOrderId) {
    return (
      <OrderConfirmation
        orderId={placedOrderId}
        restaurant={restaurant}
        onNewOrder={handleNewOrder}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20 pb-28">
      <div className="flex-1">
      {step === "landing" && (
        <LandingStep restaurant={restaurant} onSelect={handleSelectOrderType} />
      )}

      {step === "table" && (
        <TableStep
          restaurant={restaurant}
          tables={tables}
          onConfirm={handleTableConfirmed}
          onBack={() => setStep("landing")}
        />
      )}

      {step === "menu" && (
        <MenuStep
          restaurant={restaurant}
          categories={categories}
          menuItems={menuItems}
          topPicks={topPicks}
          orderType={orderType}
          tableNumber={tableNumber}
          cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
          onBack={() => setStep(orderType === "dine-in" ? "table" : "landing")}
          onSelectItem={setCustomizeItem}
          onOpenCart={() => setCartOpen(true)}
        />
      )}

      {customizeItem && (
        <ItemCustomizeSheet
          item={customizeItem}
          addOns={addOns.filter((a) => a.restaurant_id === customizeItem.restaurant_id)}
          onClose={() => setCustomizeItem(null)}
          onAdd={(cartItem) => handleAddToCart(cartItem)}
        />
      )}

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        restaurant={restaurant}
        cart={cart}
        tables={tables}
        orderType={orderType}
        tableNumber={tableNumber}
        onOrderTypeChange={setOrderType}
        onTableNumberChange={setTableNumber}
        onUpdateItem={handleUpdateCartItem}
        onRemoveItem={handleRemoveCartItem}
        onOrderPlaced={handleOrderPlaced}
      />
      </div>

      <PoweredByHilaac className="pb-6 pt-2" />
    </div>
  );
}

export type { CartItem };
