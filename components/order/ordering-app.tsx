"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AddOn,
  Category,
  CategoryAddOn,
  MenuItem,
  MenuItemAddOn,
  OrderType,
  RestaurantTable,
} from "@/types/database";
import type { CartItem } from "@/lib/order/cart-types";
import type { CreateOrderApiPayload } from "@/lib/offline-queue";
import { ensureGuestId } from "@/lib/order/guest-id";
import { findDrinksCategory, isFoodMenuItem } from "@/lib/order/drinks-category";
import { useRealtimeMenuItems } from "@/lib/hooks/use-realtime-menu-items";
import { LandingStep } from "@/components/order/landing-step";
import { TableStep } from "@/components/order/table-step";
import { MenuStep } from "@/components/order/menu-step";
import { CartSheet } from "@/components/order/cart-sheet";
import { ItemCustomizeSheet } from "@/components/order/item-customize-sheet";
import { PaymentConfirmationModal } from "@/components/order/payment-confirmation-modal";
import { OrderAppearanceProvider } from "@/components/order/order-appearance-context";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { pickHeroMenuImages } from "@/lib/order/appearance";
import {
  clearOrderDraft,
  loadOrderDraft,
  saveOrderDraft,
} from "@/lib/order/draft-cart-storage";
import { resolveItemAddOns } from "@/lib/order/resolve-item-addons";

type Step = "landing" | "table" | "menu";

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
  billing_model_dinein: "pay_before" | "pay_after";
  billing_model_takeaway: "pay_before" | "pay_after";
  brand_color?: string | null;
  custom_branding_enabled?: boolean;
  subscription_tier?: string;
}

export function OrderingApp({
  restaurant,
  categories,
  menuItems,
  addOns,
  categoryAddOns,
  menuItemAddOns,
  tables,
}: {
  restaurant: MinimalRestaurant;
  categories: Category[];
  menuItems: MenuItem[];
  addOns: AddOn[];
  categoryAddOns: CategoryAddOn[];
  menuItemAddOns: MenuItemAddOn[];
  tables: RestaurantTable[];
}) {
  const [step, setStep] = useState<Step>("landing");
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [tableNumber, setTableNumber] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartBumpKey, setCartBumpKey] = useState(0);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [showDrinksUpsell, setShowDrinksUpsell] = useState(false);
  const [drinksUpsellDismissed, setDrinksUpsellDismissed] = useState(false);
  const [ussdPayment, setUssdPayment] = useState<{
    orderIds: string[];
    code: string;
    createPayloads: CreateOrderApiPayload[];
  } | null>(null);
  const [guestReady, setGuestReady] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    ensureGuestId();
    setGuestReady(true);
  }, []);

  // Restore in-progress cart / table after reload (same restaurant, within TTL).
  useEffect(() => {
    const draft = loadOrderDraft(restaurant.slug, restaurant.id);
    if (!draft) {
      setDraftHydrated(true);
      return;
    }
    const menuById = new Map(menuItems.map((m) => [m.id, m]));
    const restoredCart = draft.cart
      .map((item) => {
        const live = menuById.get(item.menuItem?.id);
        if (!live || !live.is_available) return null;
        return { ...item, menuItem: live };
      })
      .filter((item): item is CartItem => Boolean(item));

    if (draft.orderType === "dine-in" || draft.orderType === "takeaway") {
      setOrderType(draft.orderType);
    }
    if (draft.tableNumber) setTableNumber(draft.tableNumber);
    setCart(restoredCart);

    if (draft.step === "menu" || draft.step === "table") {
      if (draft.orderType === "dine-in" && !draft.tableNumber && draft.step === "menu") {
        setStep("table");
      } else {
        setStep(draft.step);
      }
    }
    setDraftHydrated(true);
    // Intentionally once per restaurant mount — not on every menuItems refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id, restaurant.slug]);

  useEffect(() => {
    if (!draftHydrated) return;
    if (step === "landing" && cart.length === 0 && !tableNumber) {
      clearOrderDraft(restaurant.slug);
      return;
    }
    saveOrderDraft({
      restaurantId: restaurant.id,
      slug: restaurant.slug,
      step,
      orderType,
      tableNumber,
      cart,
      savedAt: Date.now(),
    });
  }, [
    draftHydrated,
    restaurant.id,
    restaurant.slug,
    step,
    orderType,
    tableNumber,
    cart,
  ]);

  const { menuItems: liveMenuItems } = useRealtimeMenuItems(restaurant.id, menuItems);

  const topPicks = useMemo(
    () => liveMenuItems.filter((m) => m.is_top_pick),
    [liveMenuItems]
  );

  const heroItems = useMemo(() => pickHeroMenuImages(liveMenuItems), [liveMenuItems]);

  const unavailableMenuIds = useMemo(
    () => new Set(liveMenuItems.filter((m) => !m.is_available).map((m) => m.id)),
    [liveMenuItems]
  );

  const drinksCategory = useMemo(() => findDrinksCategory(categories), [categories]);
  const isFullScreenStep = step === "landing" || step === "table";

  function handleSelectOrderType(type: OrderType) {
    setOrderType(type);
    if (type === "dine-in") {
      setStep("table");
    } else {
      setTableNumber("");
      setStep("menu");
    }
  }

  function handleTableConfirmed(number: string) {
    setTableNumber(number);
    setStep("menu");
  }

  function handleAddToCart(item: CartItem) {
    const hadFoodBefore = cart.some((c) => isFoodMenuItem(c.menuItem, categories));
    const addingFood = isFoodMenuItem(item.menuItem, categories);

    setCart((prev) => [...prev, item]);
    setCartBumpKey((k) => k + 1);
    setCustomizeItem(null);
    setEditingCartItem(null);

    if (
      addingFood &&
      !hadFoodBefore &&
      !drinksUpsellDismissed &&
      drinksCategory &&
      liveMenuItems.some((m) => m.category_id === drinksCategory.id && m.is_available)
    ) {
      setShowDrinksUpsell(true);
    }
  }

  function handleUpdateCartItem(cartId: string, updates: Partial<CartItem>) {
    setCart((prev) => prev.map((i) => (i.cartId === cartId ? { ...i, ...updates } : i)));
  }

  function handleRemoveCartItem(cartId: string) {
    setCart((prev) => prev.filter((i) => i.cartId !== cartId));
  }

  function handleEditCartItem(item: CartItem) {
    setCartOpen(false);
    setEditingCartItem(item);
    setCustomizeItem(item.menuItem);
  }

  function handleSaveCartItem(cartId: string, updates: Partial<CartItem>) {
    handleUpdateCartItem(cartId, updates);
    setEditingCartItem(null);
    setCustomizeItem(null);
    setCartOpen(true);
  }

  function handleCloseCustomize() {
    const wasEditing = Boolean(editingCartItem);
    setCustomizeItem(null);
    setEditingCartItem(null);
    if (wasEditing) setCartOpen(true);
  }

  function handleOrderPlaced(_orderId: string) {
    setCart([]);
    setCartOpen(false);
    clearOrderDraft(restaurant.slug);
  }

  function handleQuickAddItem(item: MenuItem) {
    const availableAddOns = resolveItemAddOns({
      item,
      addOns,
      categoryAddOns,
      menuItemAddOns,
    });
    if (availableAddOns.length > 0) {
      setCustomizeItem(item);
      return;
    }
    handleAddToCart({
      cartId: crypto.randomUUID(),
      menuItem: item,
      quantity: 1,
      selectedAddOns: [],
      notes: "",
      orderType,
    });
  }

  function handleUssdPaymentStarted(payload: {
    orderIds: string[];
    code: string;
    createPayloads: CreateOrderApiPayload[];
  }) {
    setUssdPayment(payload);
    setCart([]);
    setCartOpen(false);
    clearOrderDraft(restaurant.slug);
  }

  function handleBackFromMenu() {
    if (orderType === "dine-in") {
      // Returning to table step unlocks table re-selection.
      setStep("table");
    } else {
      setStep("landing");
    }
  }

  return (
    <OrderAppearanceProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div key={step} className="flex min-h-0 flex-1 flex-col">
          {step === "landing" && (
            <LandingStep
              restaurant={restaurant}
              heroItems={heroItems}
              onSelect={handleSelectOrderType}
            />
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
              cartBumpKey={cartBumpKey}
              showDrinksUpsell={showDrinksUpsell}
              onDismissDrinksUpsell={() => {
                setShowDrinksUpsell(false);
                setDrinksUpsellDismissed(true);
              }}
              onBack={handleBackFromMenu}
              onSelectItem={setCustomizeItem}
              onQuickAddItem={handleQuickAddItem}
              addOns={addOns}
              categoryAddOns={categoryAddOns}
              menuItemAddOns={menuItemAddOns}
              onOpenCart={() => setCartOpen(true)}
            />
          )}
        </div>

        {isFullScreenStep && <PoweredByHilaac className="shrink-0 pb-4 pt-2" />}
      </div>

      {customizeItem && (
        <ItemCustomizeSheet
          key={editingCartItem?.cartId ?? customizeItem.id}
          item={customizeItem}
          categories={categories}
          addOns={addOns}
          categoryAddOns={categoryAddOns}
          menuItemAddOns={menuItemAddOns}
          orderType={orderType}
          initialCartItem={editingCartItem}
          onClose={handleCloseCustomize}
          onAdd={(cartItem) => handleAddToCart(cartItem)}
          onSave={handleSaveCartItem}
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
        onUpdateItem={handleUpdateCartItem}
        onRemoveItem={handleRemoveCartItem}
        onEditItem={handleEditCartItem}
        onOrderPlaced={handleOrderPlaced}
        onUssdPaymentStarted={handleUssdPaymentStarted}
        guestReady={guestReady}
      />

      {ussdPayment && (
        <PaymentConfirmationModal
          open
          orderIds={ussdPayment.orderIds}
          slug={restaurant.slug}
          ussdCode={ussdPayment.code}
          createPayloads={ussdPayment.createPayloads}
          onClose={() => setUssdPayment(null)}
        />
      )}
    </OrderAppearanceProvider>
  );
}

export type { CartItem };
