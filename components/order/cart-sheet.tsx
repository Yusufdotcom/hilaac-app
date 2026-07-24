"use client";

import { useMemo, useState } from "react";
import { Loader2, Minus, Plus, Trash2, ShoppingBasket, Phone, ArrowLeft, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OrderPrimaryButton } from "@/components/order/order-primary-button";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import { customerAccentTextStyleFromAccent, HILAAC_GOLD } from "@/lib/brand/restaurant-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cartItemTotal, cartTotal, type CartItem } from "@/lib/order/cart-types";
import { billingModelForOrderType, payAfterMessage } from "@/lib/order/billing-model";
import { formatCurrency, cn } from "@/lib/utils";
import type { CreateOrderApiPayload } from "@/lib/offline-queue";
import { PaymentConfirmationModal } from "@/components/order/payment-confirmation-modal";
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
  billing_model_dinein: "pay_before" | "pay_after";
  billing_model_takeaway: "pay_before" | "pay_after";
  brand_color?: string | null;
  custom_branding_enabled?: boolean;
  subscription_tier?: string;
}

export function CartSheet({
  open,
  onOpenChange,
  restaurant,
  cart,
  unavailableMenuIds,
  tables,
  orderType,
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
  orderType: OrderType;
  tableNumber: string;
  onTableNumberChange: (value: string) => void;
  onUpdateItem: (cartId: string, updates: Partial<CartItem>) => void;
  onRemoveItem: (cartId: string) => void;
  onOrderPlaced: (orderId: string) => void;
  onUssdPaymentStarted: (payload: {
    orderIds: string[];
    code: string;
    createPayloads: CreateOrderApiPayload[];
  }) => void;
}) {
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState<"evc" | "edahab" | "place" | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"evc" | "edahab" | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDialCode, setPaymentDialCode] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const brand = useOrderBrandOptional();
  const accentStyle = customerAccentTextStyleFromAccent(brand?.accent ?? HILAAC_GOLD);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const billingModel = useMemo(
    () => billingModelForOrderType(orderType, restaurant),
    [orderType, restaurant]
  );
  const isPayBefore = billingModel === "pay_before";

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

  function buildCreatePayload(method?: "evc" | "edahab"): CreateOrderApiPayload | null {
    if (cart.length === 0) return null;
    if (orderType === "dine-in" && !tableNumber) return null;

    const table = tables.find((t) => t.table_number === tableNumber);

    return {
      restaurantId: restaurant.id,
      tableId: orderType === "dine-in" ? table?.id ?? null : null,
      orderType,
      billingModel: isPayBefore ? "pay_before" : "pay_after",
      ...(method ? { paymentMethod: method } : {}),
      customerPhone: phone || null,
      notes: null,
      items: cart.map((item) => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        addOnIds: item.selectedAddOns.map((a) => a.id),
        notes: item.notes || undefined,
      })),
    };
  }

  async function confirmPaymentForOrder(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}/confirm-payment`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not confirm payment");
      return false;
    }
    return true;
  }

  async function createOrder(method?: "evc" | "edahab") {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return null;
    }
    if (orderType === "dine-in" && !tableNumber) {
      toast.error("Fadlan geli lambarka miiska");
      return null;
    }

    const payload = buildCreatePayload(method);
    if (!payload) return null;

    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not place order");
      return null;
    }

    return {
      orderId: data.orderId as string,
      createPayload: payload,
      total: Number(data.total ?? total),
    };
  }

  async function handlePlaceOrderWithoutPayment() {
    if (hasUnavailableItems) {
      toast.error("Ka saar alaabta aan la heli karin si aad u sii wadato.");
      return;
    }

    setPlacing("place");
    try {
      const result = await createOrder();
      if (!result) return;
      onOrderPlaced(result.orderId);
    } finally {
      setPlacing(null);
    }
  }

  async function finalizePayBeforeOrder(method: "evc" | "edahab") {
    if (hasUnavailableItems) {
      toast.error("Ka saar alaabta aan la heli karin si aad u sii wadato.");
      return;
    }

    setPlacing("place");
    try {
      if (pendingOrderId) {
        onOrderPlaced(pendingOrderId);
        return;
      }

      const result = await createOrder(method);
      if (!result) return;

      const confirmed = await confirmPaymentForOrder(result.orderId);
      if (!confirmed) return;

      onOrderPlaced(result.orderId);
    } finally {
      setPlacing(null);
    }
  }

  async function handleInitiatePayment(method: "evc" | "edahab") {
    if (hasUnavailableItems) {
      toast.error("Ka saar alaabta aan la heli karin si aad u sii wadato.");
      return;
    }
    if (orderType === "dine-in" && !tableNumber) {
      toast.error("Fadlan geli lambarka miiska");
      return;
    }

    setPaymentMethod(method);
    setPendingOrderId(null);
    setPlacing(method);

    try {
      if (restaurant.payment_mode === "api") {
        const result = await createOrder(method);
        if (!result) return;

        setPendingOrderId(result.orderId);

        const res = await fetch("/api/payments/charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: result.orderId, method, phone }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Payment failed");
          setPendingOrderId(null);
          return;
        }

        setPaymentDialCode("");
        setPaymentModalOpen(true);
        return;
      }

      const code = method === "evc" ? restaurant.evc_ussd_code : restaurant.edahab_ussd_code;
      if (code) {
        const dialString = ussdDialString(code, total);
        setPaymentDialCode(dialString);
        window.location.href = `tel:${encodeURIComponent(dialString)}`;
        setPaymentModalOpen(true);
      } else {
        toast.error("Payment code not configured for this restaurant.");
      }
    } finally {
      setPlacing(null);
    }
  }

  async function handleCustomerPaymentConfirmed() {
    setPaymentModalOpen(false);
    const method = paymentMethod;
    if (!method) return;
    await finalizePayBeforeOrder(method);
  }

  const paymentDisabled = !!placing || cart.length === 0 || hasUnavailableItems;

  return (
    <>
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
            <ShoppingBasket className="h-5 w-5" style={accentStyle} aria-hidden="true" />
            Saladda
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {cart.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">Salaadu waxba kuma jiran.</p>
            ) : (
              <div className="space-y-6">
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

                {orderType === "dine-in" && (
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

            {isPayBefore ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={paymentDisabled}
                  onClick={() => handleInitiatePayment("evc")}
                  className="h-12 w-full gap-2 rounded-xl border-0 bg-[#10B981] text-base font-semibold text-white hover:bg-[#059669] active:scale-[0.98]"
                >
                  {placing === "evc" ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Smartphone className="h-5 w-5 shrink-0" aria-hidden="true" />
                  )}
                  Ku bixi EVC
                </Button>

                <Button
                  type="button"
                  size="lg"
                  disabled={paymentDisabled}
                  onClick={() => handleInitiatePayment("edahab")}
                  className="h-12 w-full gap-2 rounded-xl border-0 bg-[#F59E0B] text-base font-semibold text-white hover:bg-[#D97706] active:scale-[0.98]"
                >
                  {placing === "edahab" ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Wallet className="h-5 w-5 shrink-0" aria-hidden="true" />
                  )}
                  Ku bixi eDahab
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-center text-sm text-[#64748B]">
                  {payAfterMessage(orderType)}
                </p>
                <OrderPrimaryButton
                  type="button"
                  size="lg"
                  kind="place-order"
                  disabled={!!placing || cart.length === 0 || hasUnavailableItems}
                  onClick={handlePlaceOrderWithoutPayment}
                  className="h-12 w-full rounded-xl text-base font-semibold"
                >
                  {placing === "place" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Place Order
                </OrderPrimaryButton>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>

    {paymentModalOpen && paymentMethod && (
      <PaymentConfirmationModal
        open
        slug={restaurant.slug}
        ussdCode={paymentDialCode}
        orderIds={pendingOrderId ? [pendingOrderId] : []}
        createPayloads={
          pendingOrderId
            ? [buildCreatePayload(paymentMethod)!].filter(Boolean)
            : []
        }
        onCustomerConfirmed={handleCustomerPaymentConfirmed}
        onClose={() => setPaymentModalOpen(false)}
        deferNavigation
      />
    )}
    </>
  );
}
