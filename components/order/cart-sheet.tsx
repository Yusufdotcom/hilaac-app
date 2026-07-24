"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2,
  Minus,
  Plus,
  Trash2,
  ShoppingBasket,
  Phone,
  ArrowLeft,
  Smartphone,
  Wallet,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import {
  customerAccentTextStyleFromAccent,
  customerPrimaryButtonStyleFromAccent,
  HILAAC_GOLD,
} from "@/lib/brand/restaurant-brand";
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

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  "dine-in": "Fadhi · Dine-in",
  takeaway: "Qaadasho · Takeaway",
};

function CartItemCard({
  item,
  isUnavailable,
  onRemove,
  onAdjustQuantity,
}: {
  item: CartItem;
  isUnavailable: boolean;
  onRemove: () => void;
  onAdjustQuantity: (delta: number) => void;
}) {
  return (
    <article
      className={cn(
        "relative rounded-xl border border-gray-100 bg-white p-3 shadow-xl shadow-gray-200/50 transition-all duration-300",
        isUnavailable && "border-amber-200 bg-amber-50/30"
      )}
    >
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
        aria-label={`Remove ${item.menuItem.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="flex gap-3 pr-6">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {item.menuItem.image_url ? (
            <Image
              src={item.menuItem.image_url}
              alt={item.menuItem.name}
              fill
              className={cn("object-cover", isUnavailable && "grayscale opacity-70")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <UtensilsCrossed className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-bold leading-tight text-gray-900">{item.menuItem.name}</h3>
              <span className="shrink-0 text-base font-semibold text-gray-900">
                {formatCurrency(cartItemTotal(item))}
              </span>
            </div>

            {isUnavailable && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Out of stock — remove to continue
              </p>
            )}

            {item.selectedAddOns.length > 0 && (
              <p className="mt-0.5 text-sm text-gray-500">
                {item.selectedAddOns.map((a) => a.name).join(", ")}
              </p>
            )}

            {item.notes && (
              <p className="mt-0.5 text-xs italic text-gray-400">&ldquo;{item.notes}&rdquo;</p>
            )}
          </div>

          <div className="inline-flex w-fit items-center rounded-full border border-gray-200 bg-gray-50 p-0.5">
            <button
              type="button"
              onClick={() => onAdjustQuantity(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-white hover:text-gray-900"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[2rem] px-1 text-center text-sm font-semibold text-gray-900">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onAdjustQuantity(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-white hover:text-gray-900"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CartSection({
  title,
  items,
  unavailableMenuIds,
  onRemoveItem,
  onUpdateItem,
}: {
  title: string;
  items: CartItem[];
  unavailableMenuIds: Set<string>;
  onRemoveItem: (cartId: string) => void;
  onUpdateItem: (cartId: string, updates: Partial<CartItem>) => void;
}) {
  if (items.length === 0) return null;

  function adjustQuantity(item: CartItem, delta: number) {
    const next = item.quantity + delta;
    if (next <= 0) {
      onRemoveItem(item.cartId);
    } else {
      onUpdateItem(item.cartId, { quantity: next });
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-widest text-gray-500">{title}</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <CartItemCard
            key={item.cartId}
            item={item}
            isUnavailable={unavailableMenuIds.has(item.menuItem.id)}
            onRemove={() => onRemoveItem(item.cartId)}
            onAdjustQuantity={(delta) => adjustQuantity(item, delta)}
          />
        ))}
      </div>
    </section>
  );
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
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState<"evc" | "edahab" | "place" | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"evc" | "edahab" | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDialCode, setPaymentDialCode] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const brand = useOrderBrandOptional();
  const accent = brand?.accent ?? HILAAC_GOLD;
  const customBrandingActive = brand?.customBrandingActive ?? false;
  const accentStyle = customerAccentTextStyleFromAccent(accent);
  const placeOrderStyle = customerPrimaryButtonStyleFromAccent(accent, customBrandingActive);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const billingModel = useMemo(
    () => billingModelForOrderType(orderType, restaurant),
    [orderType, restaurant]
  );
  const isPayBefore = billingModel === "pay_before";

  const dineInItems = useMemo(() => cart.filter((i) => i.orderType === "dine-in"), [cart]);
  const takeawayItems = useMemo(() => cart.filter((i) => i.orderType === "takeaway"), [cart]);
  const showGroupedSections = dineInItems.length > 0 && takeawayItems.length > 0;
  const showTableInput = orderType === "dine-in" || dineInItems.length > 0;

  const hasUnavailableItems = useMemo(
    () => cart.some((item) => unavailableMenuIds.has(item.menuItem.id)),
    [cart, unavailableMenuIds]
  );

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

  function phoneDigits(value: string) {
    return value.replace(/\D/g, "");
  }

  function isValidPhone(value: string) {
    return phoneDigits(value).length >= 10;
  }

  async function createOrder(method?: "evc" | "edahab") {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return null;
    }
    if (!isValidPhone(phone)) {
      toast.error("Fadlan geli lambarka taleefanka (ugu yaraan 10 digit)");
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
    if (!isValidPhone(phone)) {
      toast.error("Fadlan geli lambarka taleefanka (ugu yaraan 10 digit)");
      return;
    }

    setPlacing("place");
    try {
      const result = await createOrder();
      if (!result) return;
      goToStatusPage(result.orderId);
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
        goToStatusPage(pendingOrderId);
        return;
      }

      const result = await createOrder(method);
      if (!result) return;

      const confirmed = await confirmPaymentForOrder(result.orderId);
      if (!confirmed) return;

      goToStatusPage(result.orderId);
    } finally {
      setPlacing(null);
    }
  }

  async function handleInitiatePayment(method: "evc" | "edahab") {
    if (hasUnavailableItems) {
      toast.error("Ka saar alaabta aan la heli karin si aad u sii wadato.");
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error("Fadlan geli lambarka taleefanka (ugu yaraan 10 digit)");
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

  const phoneValid = isValidPhone(phone);
  const paymentDisabled = !!placing || cart.length === 0 || hasUnavailableItems || !phoneValid;

  function goToStatusPage(orderId: string) {
    onOpenChange(false);
    onOrderPlaced(orderId);
    router.push(`/order/${restaurant.slug}/status?orderId=${orderId}`);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          overlayClassName="bg-black/40 backdrop-blur-sm"
          className={cn(
            "mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col gap-0 overflow-hidden",
            "rounded-none border-0 bg-gray-50 p-0 shadow-xl shadow-gray-200/50",
            "transition-all duration-300 sm:rounded-t-2xl"
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header */}
          <SheetHeader className="relative shrink-0 space-y-0 border-b border-gray-100 bg-white px-5 pb-4 pt-5 pr-12 text-left">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute left-4 top-5 flex items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
              aria-label="Back to menu"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <SheetTitle className="flex items-center justify-center gap-2.5 pl-6 text-xl font-bold text-gray-900">
              <ShoppingBasket className="h-5 w-5" style={accentStyle} aria-hidden="true" />
              Saladda
            </SheetTitle>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            {/* Scrollable items */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl shadow-gray-200/50">
                    <ShoppingBasket className="h-8 w-8 text-gray-300" aria-hidden="true" />
                  </div>
                  <p className="text-gray-500">Salaadu waxba kuma jiran.</p>
                </div>
              ) : showGroupedSections ? (
                <div className="space-y-6">
                  <CartSection
                    title={ORDER_TYPE_LABELS["dine-in"]}
                    items={dineInItems}
                    unavailableMenuIds={unavailableMenuIds}
                    onRemoveItem={onRemoveItem}
                    onUpdateItem={onUpdateItem}
                  />
                  <CartSection
                    title={ORDER_TYPE_LABELS.takeaway}
                    items={takeawayItems}
                    unavailableMenuIds={unavailableMenuIds}
                    onRemoveItem={onRemoveItem}
                    onUpdateItem={onUpdateItem}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <CartItemCard
                      key={item.cartId}
                      item={item}
                      isUnavailable={unavailableMenuIds.has(item.menuItem.id)}
                      onRemove={() => onRemoveItem(item.cartId)}
                      onAdjustQuantity={(delta) => {
                        const next = item.quantity + delta;
                        if (next <= 0) onRemoveItem(item.cartId);
                        else onUpdateItem(item.cartId, { quantity: next });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Checkout footer */}
            {cart.length > 0 && (
              <div className="shrink-0 space-y-4 rounded-t-2xl border-t border-gray-100 bg-white px-5 py-5 shadow-[0_-8px_32px_rgba(0,0,0,0.06)]">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cart-phone" className="text-sm font-medium text-gray-700">
                      Lambarka taleefanka <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Phone
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                        aria-hidden="true"
                      />
                      <Input
                        id="cart-phone"
                        type="tel"
                        inputMode="tel"
                        required
                        placeholder="0612345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="rounded-lg border-gray-200 bg-gray-50 pl-10 focus-visible:bg-white"
                        aria-invalid={phone.length > 0 && !phoneValid}
                      />
                    </div>
                    {phone.length > 0 && !phoneValid && (
                      <p className="text-xs text-red-600">Geli ugu yaraan 10 digit.</p>
                    )}
                  </div>

                  {showTableInput && (
                    <div className="space-y-1.5">
                      <Label htmlFor="cart-table" className="text-sm font-medium text-gray-700">
                        Lambarka miiska
                      </Label>
                      <Input
                        id="cart-table"
                        placeholder="e.g. 12"
                        value={tableNumber}
                        onChange={(e) => onTableNumberChange(e.target.value)}
                        className="rounded-lg border-gray-200 bg-gray-50 focus-visible:bg-white"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="text-base font-medium text-gray-600">Wadarta</span>
                  <span className="text-2xl font-bold" style={accentStyle}>
                    {formatCurrency(total)}
                  </span>
                </div>

                {isPayBefore ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      size="lg"
                      disabled={paymentDisabled}
                      onClick={() => handleInitiatePayment("evc")}
                      className="h-12 w-full gap-2 rounded-xl border-0 bg-[#10B981] text-base font-semibold text-white shadow-md shadow-emerald-200/50 transition-all duration-300 hover:bg-[#059669] active:scale-[0.98]"
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
                      className="h-12 w-full gap-2 rounded-xl border-0 bg-[#F59E0B] text-base font-semibold text-white shadow-md shadow-amber-200/50 transition-all duration-300 hover:bg-[#D97706] active:scale-[0.98]"
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
                    <p className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-center text-sm text-gray-600">
                      {payAfterMessage(orderType)}
                    </p>
                    <button
                      type="button"
                      disabled={paymentDisabled}
                      onClick={handlePlaceOrderWithoutPayment}
                      className={cn(
                        "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white",
                        "shadow-lg transition-all duration-300 hover:opacity-90 active:scale-[0.98]",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                      )}
                      style={placeOrderStyle}
                    >
                      {placing === "place" ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      ) : null}
                      Place Order
                    </button>
                  </div>
                )}
              </div>
            )}
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
            pendingOrderId ? [buildCreatePayload(paymentMethod)!].filter(Boolean) : []
          }
          onCustomerConfirmed={handleCustomerPaymentConfirmed}
          onClose={() => setPaymentModalOpen(false)}
          deferNavigation
        />
      )}
    </>
  );
}
