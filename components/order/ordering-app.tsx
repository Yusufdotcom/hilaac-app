"use client";

import { useMemo, useState } from "react";
import type { AddOn, Category, MenuItem, RestaurantTable } from "@/types/database";
import type { CartItem } from "@/lib/order/cart-types";
import type { CreateOrderApiPayload } from "@/lib/offline-queue";
import { useRealtimeMenuItems } from "@/lib/hooks/use-realtime-menu-items";
import { LandingStep } from "@/components/order/landing-step";
import { TableStep } from "@/components/order/table-step";
import { MenuStep } from "@/components/order/menu-step";
import { CartSheet } from "@/components/order/cart-sheet";
import { ItemCustomizeSheet } from "@/components/order/item-customize-sheet";
import { OrderConfirmation } from "@/components/order/order-confirmation";
import { PaymentConfirmationModal } from "@/components/order/payment-confirmation-modal";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { cn } from "@/lib/utils";

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
  const [ussdPayment, setUssdPayment] = useState<{
    orderId: string;
    code: string;
    createPayload: CreateOrderApiPayload;
  } | null>(null);

  const { menuItems: liveMenuItems } = useRealtimeMenuItems(restaurant.id, menuItems);

  const topPicks = useMemo(
    () => liveMenuItems.filter((m) => m.is_top_pick),
    [liveMenuItems]
  );

  const unavailableMenuIds = useMemo(
    () => new Set(liveMenuItems.filter((m) => !m.is_available).map((m) => m.id)),
    [liveMenuItems]
  );

  const isFullScreenStep = step === "landing" || step === "table";

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

  function handleUssdPaymentStarted(payload: {
    orderId: string;
    code: string;
    createPayload: CreateOrderApiPayload;
  }) {
    setUssdPayment(payload);
    setCart([]);
    setCartOpen(false);
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
    <>
      <div
        className={cn(
          "flex h-[100dvh] flex-col overflow-hidden bg-muted/20",
        )}
      >
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
            key={`${orderType}-${tableNumber}`}
            restaurant={restaurant}
            categories={categories}
            menuItems={liveMenuItems}
            topPicks={topPicks}
            orderType={orderType}
            tableNumber={tableNumber}
            cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
            onBack={() => setStep(orderType === "dine-in" ? "table" : "landing")}
            onSelectItem={setCustomizeItem}
            onOpenCart={() => setCartOpen(true)}
          />
        )}

        {isFullScreenStep && <PoweredByHilaac className="shrink-0 pb-4 pt-2" />}
      </div>

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
        unavailableMenuIds={unavailableMenuIds}
        tables={tables}
        orderType={orderType}
        tableNumber={tableNumber}
        onOrderTypeChange={setOrderType}
        onTableNumberChange={setTableNumber}
        onUpdateItem={handleUpdateCartItem}
        onRemoveItem={handleRemoveCartItem}
        onOrderPlaced={handleOrderPlaced}
        onUssdPaymentStarted={handleUssdPaymentStarted}
      />

      {ussdPayment && (
        <PaymentConfirmationModal
          open
          orderId={ussdPayment.orderId}
          slug={restaurant.slug}
          ussdCode={ussdPayment.code}
          createPayload={ussdPayment.createPayload}
          onClose={() => setUssdPayment(null)}
        />
      )}
    </>
  );
}

export type { CartItem };
