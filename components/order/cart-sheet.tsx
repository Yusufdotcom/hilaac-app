"use client";

import { useMemo, useState } from "react";
import { Loader2, Minus, Plus, Trash2, ShoppingBasket, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cartItemTotal, cartTotal } from "@/lib/order/cart-types";
import { formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/lib/order/cart-types";
import type { RestaurantTable } from "@/types/database";

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

export function CartSheet({
  open,
  onOpenChange,
  restaurant,
  cart,
  tables,
  orderType,
  tableNumber,
  onOrderTypeChange,
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
  tables: RestaurantTable[];
  orderType: "dine-in" | "takeaway";
  tableNumber: string;
  onOrderTypeChange: (type: "dine-in" | "takeaway") => void;
  onTableNumberChange: (value: string) => void;
  onUpdateItem: (cartId: string, updates: Partial<CartItem>) => void;
  onRemoveItem: (cartId: string) => void;
  onOrderPlaced: (orderId: string) => void;
  onUssdPaymentStarted: (payload: { orderId: string; code: string }) => void;
}) {
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState<"evc" | "edahab" | null>(null);

  const total = useMemo(() => cartTotal(cart), [cart]);

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

  async function createOrder(method: "evc" | "edahab") {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return null;
    }
    if (orderType === "dine-in" && !tableNumber) {
      toast.error("Fadlan geli lambarka miiska");
      return null;
    }

    const table = tables.find((t) => t.table_number === tableNumber);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        tableId: orderType === "dine-in" ? table?.id ?? null : null,
        orderType,
        paymentMethod: method,
        customerPhone: phone || null,
        notes: notes || null,
        items: cart.map((item) => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          addOnIds: item.selectedAddOns.map((a) => a.id),
          notes: item.notes || undefined,
        })),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not place order");
      return null;
    }

    return data.orderId as string;
  }

  async function handlePay(method: "evc" | "edahab") {
    setPlacing(method);
    try {
      const orderId = await createOrder(method);
      if (!orderId) return;

      if (restaurant.payment_mode === "ussd") {
        const code = method === "evc" ? restaurant.evc_ussd_code : restaurant.edahab_ussd_code;
        if (code) {
          const dialString = ussdDialString(code, total);
          window.location.href = `tel:${encodeURIComponent(dialString)}`;
          onOpenChange(false);
          onUssdPaymentStarted({ orderId, code: dialString });
        } else {
          onOrderPlaced(orderId);
        }
      } else {
        const res = await fetch("/api/payments/charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, method, phone }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Payment failed");
        } else {
          toast.success("Payment initiated. Confirming...");
        }
        onOrderPlaced(orderId);
      }
    } finally {
      setPlacing(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="mx-auto flex max-h-[92vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0"
        >
          <SheetHeader className="shrink-0 space-y-0 px-6 pb-4 pt-6 pr-12 text-left">
            <SheetTitle className="flex items-center gap-2.5">
              <ShoppingBasket className="h-5 w-5 text-[#D4A373]" aria-hidden="true" />
              Saladda
            </SheetTitle>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {cart.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">Salaadu waa madhan tahay.</p>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.cartId} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{item.menuItem.name}</p>
                            {item.selectedAddOns.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                + {item.selectedAddOns.map((a) => a.name).join(", ")}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-xs italic text-muted-foreground">&ldquo;{item.notes}&rdquo;</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
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
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cart-notes" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Tilmaamo gaar ah
                    </Label>
                    <div className="relative">
                      <MessageSquare
                        className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Textarea
                        id="cart-notes"
                        placeholder="Special instructions for your whole order"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="min-h-[88px] pl-10"
                      />
                    </div>
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
                        placeholder="+252..."
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Nooca dalabka</Label>
                    <RadioGroup
                      value={orderType}
                      onValueChange={(v) => onOrderTypeChange(v as "dine-in" | "takeaway")}
                      className="grid grid-cols-2 gap-3"
                    >
                      {restaurant.dine_in_enabled && (
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                          <RadioGroupItem value="dine-in" id="cart-dinein" />
                          Fadhi
                        </label>
                      )}
                      {restaurant.takeaway_enabled && (
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                          <RadioGroupItem value="takeaway" id="cart-takeaway" />
                          Qaadasho
                        </label>
                      )}
                    </RadioGroup>

                    {orderType === "dine-in" && (
                      <Input
                        placeholder="Lambarka miiska"
                        value={tableNumber}
                        onChange={(e) => onTableNumberChange(e.target.value)}
                      />
                    )}
                  </div>
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
                disabled={!!placing || cart.length === 0}
                onClick={() => handlePay("evc")}
                className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700"
              >
                {placing === "evc" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                EVC
              </Button>

              <Button
                type="button"
                size="lg"
                disabled={!!placing || cart.length === 0}
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
