"use client";

import { useMemo, useState } from "react";
import { Loader2, Minus, Plus, Trash2, ShoppingBasket, Phone, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cartHasOrderType,
  cartItemTotal,
  cartItemsByType,
  cartTotal,
  sessionAllowsBothTypes,
  type CartItem,
  type SessionSelection,
} from "@/lib/order/cart-types";
import { formatCurrency, cn } from "@/lib/utils";
import type { CreateOrderApiPayload } from "@/lib/offline-queue";
import type { OrderType, RestaurantTable } from "@/types/database";

interface MinimalRestaurant {
  id: string;
  name: string;
  slug: string;
  payment_mode: "ussd" | "api";
  evc_ussd_code: string | null;
  edahab_ussd_code: string | null;
  dine_in_enabled: boolean;
  takeaway_enabled: boolean;
}

function ItemOrderTypeToggle({
  value,
  onChange,
}: {
  value: OrderType;
  onChange: (type: OrderType) => void;
}) {
  return (
    <div className="mt-2 inline-flex rounded-lg border bg-muted/40 p-0.5">
      <button
        type="button"
        onClick={() => onChange("dine-in")}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          value === "dine-in"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        🍽️ Fadhi
      </button>
      <button
        type="button"
        onClick={() => onChange("takeaway")}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          value === "takeaway"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        📦 Qaadasho
      </button>
    </div>
  );
}

export function CartSheet({
  open,
  onOpenChange,
  restaurant,
  cart,
  unavailableMenuIds,
  tables,
  sessionSelection,
  tableNumber,
  onTableNumberChange,
  onUpdateItem,
  onRemoveItem,
  onOrderPlaced,
  onUssdPaymentStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: MinimalRestaurant;
  cart: CartItem[];
  unavailableMenuIds: Set<string>;
  tables: RestaurantTable[];
  sessionSelection: SessionSelection;
  tableNumber: string;
  onTableNumberChange: (value: string) => void;
  onUpdateItem: (cartId: string, updates: Partial<CartItem>) => void;
  onRemoveItem: (cartId: string) => void;
  onOrderPlaced: (orderIds: string[]) => void;
  onUssdPaymentStarted: (payload: {
    orderIds: string[];
    code: string;
    createPayloads: CreateOrderApiPayload[];
  }) => void;
}) {
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState<"evc" | "edahab" | null>(null);

  const showItemTypeToggle = sessionAllowsBothTypes(sessionSelection);
  const needsTableNumber = cartHasOrderType(cart, "dine-in");
  const splitCheckout = cartHasOrderType(cart, "dine-in") && cartHasOrderType(cart, "takeaway");

  const total = useMemo(() => cartTotal(cart), [cart]);

  const hasUnavailableItems = useMemo(
    () => cart.some((item) => unavailableMenuIds.has(item.menuItem.id)),
    [cart, unavailableMenuIds]
  );

  function adjustQuantity(item: CartItem, delta: number) {
    const next = item.quantity + delta;
    if (next <= 0) {
      onRemoveItem(item.cartId);
    } else {
      onUpdateItem(item.cartId, { quantity: next });
    }
  }

  function ussdDialString(code: string, amount: number) {
    const trimmed = code.endsWith("#") ? code.slice(0, -1) : code;
    return `${trimmed}${Math.round(amount)}#`;
  }

  function buildCreatePayload(
    items: CartItem[],
    orderType: OrderType,
    method: "evc" | "edahab"
  ): CreateOrderApiPayload | null {
    if (items.length === 0) return null;
    if (orderType === "dine-in" && !tableNumber) return null;

    const table = tables.find((t) => t.table_number === tableNumber);

    return {
      restaurantId: restaurant.id,
      tableId: orderType === "dine-in" ? table?.id ?? null : null,
      orderType,
      paymentMethod: method,
      customerPhone: phone || null,
      notes: null,
      items: items.map((item) => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        addOnIds: item.selectedAddOns.map((a) => a.id),
        notes: item.notes || undefined,
      })),
    };
  }

  async function postOrder(payload: CreateOrderApiPayload) {
    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Could not place order");
    }

    return {
      orderId: data.orderId as string,
      total: Number(data.total ?? 0),
    };
  }

  async function createOrders(method: "evc" | "edahab") {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return null;
    }
    if (needsTableNumber && !tableNumber) {
      toast.error("Fadlan geli lambarka miiska");
      return null;
    }

    const dineInItems = cartItemsByType(cart, "dine-in");
    const takeawayItems = cartItemsByType(cart, "takeaway");
    const payloads: CreateOrderApiPayload[] = [];
    const orderIds: string[] = [];
    let combinedTotal = 0;

    const dineInPayload = buildCreatePayload(dineInItems, "dine-in", method);
    if (dineInPayload) payloads.push(dineInPayload);

    const takeawayPayload = buildCreatePayload(takeawayItems, "takeaway", method);
    if (takeawayPayload) payloads.push(takeawayPayload);

    if (payloads.length === 0) {
      toast.error("Could not build order");
      return null;
    }

    try {
      for (const payload of payloads) {
        const result = await postOrder(payload);
        orderIds.push(result.orderId);
        combinedTotal += result.total;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not place order");
      return null;
    }

    return { orderIds, createPayloads: payloads, combinedTotal };
  }

  async function handlePay(method: "evc" | "edahab") {
    if (hasUnavailableItems) {
      toast.error("Ka saar alaabta aan la heli karin si aad u sii wadato.");
      return;
    }

    setPlacing(method);
    try {
      const result = await createOrders(method);
      if (!result) return;

      const { orderIds, createPayloads, combinedTotal } = result;

      if (restaurant.payment_mode === "ussd") {
        const code = method === "evc" ? restaurant.evc_ussd_code : restaurant.edahab_ussd_code;
        if (code) {
          const dialString = ussdDialString(code, combinedTotal);
          window.location.href = `tel:${encodeURIComponent(dialString)}`;
          onOpenChange(false);
          onUssdPaymentStarted({ orderIds, code: dialString, createPayloads });
        } else {
          onOrderPlaced(orderIds);
        }
      } else {
        for (const orderId of orderIds) {
          const res = await fetch("/api/payments/charge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, method, phone }),
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error ?? "Payment failed");
            return;
          }
        }
        toast.success(
          orderIds.length > 1
            ? "Payments initiated for both orders. Confirming..."
            : "Payment initiated. Confirming..."
        );
        onOrderPlaced(orderIds);
      }
    } finally {
      setPlacing(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-none p-0 sm:rounded-t-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="relative shrink-0 space-y-0 border-b px-6 pb-4 pt-5 pr-12 text-left">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute left-4 top-5 flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Back to menu"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <SheetTitle className="flex items-center justify-center gap-2.5 pl-6">
            <ShoppingBasket className="h-5 w-5 text-[#D4A373]" aria-hidden="true" />
            Saladda
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {cart.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">Salaadu waxba kuma jiran.</p>
            ) : (
              <div className="space-y-6">
                {splitCheckout && (
                  <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    Waxaa la sameyn doonaa 2 dalab oo gooni ah: mid miiska iyo mid qaadasho.
                  </p>
                )}

                <div className="space-y-3">
                  {cart.map((item) => {
                    const isUnavailable = unavailableMenuIds.has(item.menuItem.id);
                    return (
                      <div
                        key={item.cartId}
                        className={cn(
                          "rounded-xl border p-3",
                          isUnavailable && "border-amber-300 bg-amber-50/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{item.menuItem.name}</p>
                            {isUnavailable && (
                              <p className="mt-1 text-xs font-medium text-amber-800">
                                This item is out of stock. Please remove it from your cart to continue.
                              </p>
                            )}
                            {item.selectedAddOns.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                + {item.selectedAddOns.map((a) => a.name).join(", ")}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-xs italic text-muted-foreground">
                                &ldquo;{item.notes}&rdquo;
                              </p>
                            )}
                            {showItemTypeToggle ? (
                              <ItemOrderTypeToggle
                                value={item.orderType}
                                onChange={(orderType) => onUpdateItem(item.cartId, { orderType })}
                              />
                            ) : (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.orderType === "dine-in" ? "🍽️ Fadhi" : "📦 Qaadasho"}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="font-semibold">{formatCurrency(cartItemTotal(item))}</span>
                            <Button variant="ghost" size="icon" onClick={() => onRemoveItem(item.cartId)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => adjustQuantity(item, -1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => adjustQuantity(item, 1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cart-phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Lambarka taleefanka (ikhtiyaari)
                  </Label>
                  <div className="relative">
                    <Phone
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="cart-phone"
                      placeholder="061..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {needsTableNumber && (
                  <div className="space-y-2">
                    <Label htmlFor="cart-table">Lambarka miiska</Label>
                    <Input
                      id="cart-table"
                      placeholder="e.g. 12"
                      value={tableNumber}
                      onChange={(e) => onTableNumberChange(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 shrink-0 space-y-3 border-t bg-background px-6 py-4">
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Wadarta</span>
              <span>{formatCurrency(total)}</span>
            </div>

            <Button
              type="button"
              size="lg"
              disabled={!!placing || cart.length === 0 || hasUnavailableItems}
              onClick={() => handlePay("evc")}
              className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700"
            >
              {placing === "evc" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              EVC
            </Button>

            <Button
              type="button"
              size="lg"
              disabled={!!placing || cart.length === 0 || hasUnavailableItems}
              onClick={() => handlePay("edahab")}
              className="h-12 w-full rounded-xl bg-amber-500 text-base font-semibold text-white hover:bg-amber-600"
            >
              {placing === "edahab" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              eDahab
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
