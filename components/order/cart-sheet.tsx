"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Loader2,
  Minus,
  Plus,
  Trash2,
  Pencil,
  ShoppingBasket,
  Phone,
  ArrowLeft,
  Smartphone,
  Wallet,
  UtensilsCrossed,
  Armchair,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import { useOrderAppearanceOptional } from "@/components/order/order-appearance-context";
import {
  brandColorWithAlpha,
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
import { OrderSubmittingOverlay } from "@/components/order/order-preparing-screen";
import {
  clearPendingOrderHandoff,
  createTempOrderId,
  ORDER_REDIRECT_DELAY_MS,
  savePendingOrderHandoff,
  saveResolvedOrderId,
} from "@/lib/order/pending-order-handoff";
import { ensureGuestId, getGuestId } from "@/lib/order/guest-id";
import { createClient } from "@/lib/supabase/client";
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
  onEdit,
  onAdjustQuantity,
}: {
  item: CartItem;
  isUnavailable: boolean;
  onRemove: () => void;
  onEdit: () => void;
  onAdjustQuantity: (delta: number) => void;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border/80 bg-card p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]",
        isUnavailable && "border-amber-200/80 bg-amber-50/30"
      )}
    >
      <div className="flex gap-3.5">
        <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60">
          {item.menuItem.image_url ? (
            <Image
              src={item.menuItem.image_url}
              alt={item.menuItem.name}
              fill
              sizes="72px"
              quality={60}
              loading="lazy"
              className={cn("object-cover", isUnavailable && "grayscale opacity-70")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
              <UtensilsCrossed className="h-7 w-7" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] font-bold leading-snug tracking-tight text-foreground">
                {item.menuItem.name}
              </h3>
              {item.selectedAddOns.length > 0 && (
                <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                  {item.selectedAddOns.map((a) => a.name).join(" · ")}
                </p>
              )}
              {item.notes && (
                <p className="mt-1 text-xs italic text-muted-foreground/80">&ldquo;{item.notes}&rdquo;</p>
              )}
              {isUnavailable && (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  Out of stock — remove to continue
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[15px] font-semibold tabular-nums text-foreground/80">
                {formatCurrency(cartItemTotal(item))}
              </span>
              <button
                type="button"
                onClick={onRemove}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                aria-label={`Remove ${item.menuItem.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex w-fit items-center rounded-full border border-border bg-muted/60 p-0.5">
              <button
                type="button"
                onClick={() => onAdjustQuantity(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 transition-colors active:bg-background"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[2rem] px-1 text-center text-base font-bold tabular-nums text-foreground">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onAdjustQuantity(1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 transition-colors active:bg-background"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
              Edit
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
  onEditItem,
}: {
  title: string;
  items: CartItem[];
  unavailableMenuIds: Set<string>;
  onRemoveItem: (cartId: string) => void;
  onUpdateItem: (cartId: string, updates: Partial<CartItem>) => void;
  onEditItem: (item: CartItem) => void;
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
    <section className="space-y-3.5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-3.5">
        {items.map((item) => (
          <CartItemCard
            key={item.cartId}
            item={item}
            isUnavailable={unavailableMenuIds.has(item.menuItem.id)}
            onRemove={() => onRemoveItem(item.cartId)}
            onEdit={() => onEditItem(item)}
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
  onUpdateItem,
  onRemoveItem,
  onEditItem,
  onOrderPlaced,
  onUssdPaymentStarted,
  guestReady = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: MinimalRestaurant;
  cart: CartItem[];
  unavailableMenuIds: Set<string>;
  tables: RestaurantTable[];
  orderType: OrderType;
  /** Locked after table-select step — display only, not editable here. */
  tableNumber: string;
  onUpdateItem: (cartId: string, updates: Partial<CartItem>) => void;
  onRemoveItem: (cartId: string) => void;
  onEditItem: (item: CartItem) => void;
  onOrderPlaced: (orderId: string) => void;
  onUssdPaymentStarted: (payload: {
    orderIds: string[];
    code: string;
    createPayloads: CreateOrderApiPayload[];
  }) => void;
  /** True once the parent menu page has bootstrapped a guest id. */
  guestReady?: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [whatsappMarketingOptIn, setWhatsappMarketingOptIn] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [placing, setPlacing] = useState<"evc" | "edahab" | "place" | null>(null);
  const [submittingOverlay, setSubmittingOverlay] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"evc" | "edahab" | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDialCode, setPaymentDialCode] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);
  const lastSubmitRef = useRef<null | (() => Promise<void>)>(null);
  const redirectTimerRef = useRef<number | null>(null);
  const navigatedRef = useRef(false);
  const redirectOrderIdRef = useRef<string | null>(null);

  const brand = useOrderBrandOptional();
  const appearance = useOrderAppearanceOptional();
  const accent = brand?.accent ?? HILAAC_GOLD;
  const customBrandingActive = brand?.customBrandingActive ?? false;
  const accentStyle = customerAccentTextStyleFromAccent(accent);
  const placeOrderStyle = customerPrimaryButtonStyleFromAccent(accent, customBrandingActive);

  // Wait for a valid auth session OR guest id before enabling Place Order / Ku bixi.
  useEffect(() => {
    let cancelled = false;

    async function resolveReady() {
      const guestId = ensureGuestId();

      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.user || guestId || getGuestId() || guestReady) {
          setIsReady(true);
          return;
        }
      } catch {
        // Auth client may fail on first paint in Incognito — guest id is enough.
      }

      if (!cancelled && (guestId || getGuestId() || guestReady)) {
        setIsReady(true);
      }
    }

    void resolveReady();
    return () => {
      cancelled = true;
    };
  }, [guestReady]);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const billingModel = useMemo(
    () => billingModelForOrderType(orderType, restaurant),
    [orderType, restaurant]
  );
  const isPayBefore = billingModel === "pay_before";

  const dineInItems = useMemo(() => cart.filter((i) => i.orderType === "dine-in"), [cart]);
  const takeawayItems = useMemo(() => cart.filter((i) => i.orderType === "takeaway"), [cart]);
  const showGroupedSections = dineInItems.length > 0 && takeawayItems.length > 0;
  const showTableLabel =
    (orderType === "dine-in" || dineInItems.length > 0) && Boolean(tableNumber);

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
      whatsappMarketingOptIn,
      notes: null,
      items: cart.map((item) => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        addOnIds: item.selectedAddOns.map((a) => a.id),
        notes: item.notes || undefined,
      })),
    };
  }

  function phoneDigits(value: string) {
    return value.replace(/\D/g, "");
  }

  function isValidPhone(value: string) {
    return phoneDigits(value).length >= 10;
  }

  function validateCheckoutBasics() {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return false;
    }
    if (hasUnavailableItems) {
      toast.error("Ka saar alaabta aan la heli karin si aad u sii wadato.");
      return false;
    }
    if (!isValidPhone(phone)) {
      toast.error("Fadlan geli lambarka taleefanka (ugu yaraan 10 digit)");
      return false;
    }
    if (orderType === "dine-in" && !tableNumber) {
      toast.error("Fadlan dooro miiskaaga marka hore");
      return false;
    }
    return true;
  }

  async function createOrder(
    method?: "evc" | "edahab",
    signal?: AbortSignal
  ) {
    const payload = buildCreatePayload(method);
    if (!payload) return null;

    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to create order. Please try again.");
    }
    if (!data.orderId) {
      throw new Error("Failed to create order. Please try again.");
    }

    return {
      orderId: data.orderId as string,
      createPayload: payload,
      total: Number(data.total ?? total),
    };
  }

  async function confirmPaymentForOrder(orderId: string, signal?: AbortSignal) {
    const res = await fetch(`/api/orders/${orderId}/confirm-payment`, {
      method: "POST",
      signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Could not confirm payment");
    }
  }

  function clearRedirectTimer() {
    if (redirectTimerRef.current != null) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }

  /** Hard navigate — guaranteed via window.location.href on all devices. */
  function goToStatusPage(orderId: string, options?: { pending?: boolean }) {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    clearRedirectTimer();
    onOpenChange(false);
    onOrderPlaced(orderId);
    const pendingQuery = options?.pending ? "&pending=1" : "";
    window.location.href = `/order/${restaurant.slug}/status?orderId=${orderId}${pendingQuery}`;
  }

  /**
   * Shows the preparing overlay immediately, starts create in the background,
   * and always redirects after 3s so slow networks still reach Status.
   */
  async function runOrderSubmission(options: {
    method?: "evc" | "edahab";
    confirmPayment?: boolean;
    existingOrderId?: string | null;
  }) {
    submitAbortRef.current?.abort();
    clearRedirectTimer();
    navigatedRef.current = false;

    const controller = new AbortController();
    submitAbortRef.current = controller;

    setSubmitError(null);
    setSubmittingOverlay(true);
    setPlacing("place");

    // API path already has a real order id — just confirm (if needed) then redirect on the 3s timer.
    if (options.existingOrderId) {
      redirectOrderIdRef.current = options.existingOrderId;
      redirectTimerRef.current = window.setTimeout(() => {
        goToStatusPage(redirectOrderIdRef.current ?? options.existingOrderId!);
      }, ORDER_REDIRECT_DELAY_MS);

      try {
        if (options.confirmPayment) {
          await confirmPaymentForOrder(options.existingOrderId, controller.signal);
        }
        if (controller.signal.aborted || navigatedRef.current) return;
        // Prefer early redirect once confirm succeeds; 3s timer covers slow paths.
        goToStatusPage(options.existingOrderId);
      } catch (err) {
        if (controller.signal.aborted || navigatedRef.current) return;
        const message =
          err instanceof Error ? err.message : "Failed to create order. Please try again.";
        setSubmitError(message);
        setPlacing(null);
        clearRedirectTimer();
      }
      return;
    }

    const payload = buildCreatePayload(options.method);
    if (!payload) {
      setSubmitError("Failed to create order. Please try again.");
      setPlacing(null);
      return;
    }

    const tempId = createTempOrderId();
    redirectOrderIdRef.current = tempId;
    savePendingOrderHandoff({
      tempId,
      slug: restaurant.slug,
      payload,
      confirmPayment: options.confirmPayment,
      createdAt: Date.now(),
    });

    // Guaranteed Status landing after 3s. Status page creates the order from the handoff
    // (avoids double-create if we also kicked off create here).
    redirectTimerRef.current = window.setTimeout(() => {
      goToStatusPage(tempId, { pending: true });
    }, ORDER_REDIRECT_DELAY_MS);

    // Kick off create early so the order often exists before/when Status mounts.
    try {
      const result = await createOrder(options.method, controller.signal);
      if (!result) throw new Error("Failed to create order. Please try again.");

      if (options.confirmPayment) {
        await confirmPaymentForOrder(result.orderId, controller.signal);
      }

      saveResolvedOrderId(tempId, result.orderId);
      clearPendingOrderHandoff(tempId);
      redirectOrderIdRef.current = result.orderId;

      if (controller.signal.aborted || navigatedRef.current) return;

      // Prefer real id as soon as create succeeds; 3s timer still covers slow networks.
      goToStatusPage(result.orderId);
    } catch (err) {
      if (controller.signal.aborted || navigatedRef.current) return;
      // Leave handoff intact for Status to fulfill; keep the 3s redirect timer.
      const message =
        err instanceof Error ? err.message : "Failed to create order. Please try again.";
      setSubmitError(message);
      setPlacing(null);
    }
  }

  async function handlePlaceOrderWithoutPayment() {
    if (!validateCheckoutBasics()) return;

    const submit = async () => {
      await runOrderSubmission({});
    };

    lastSubmitRef.current = submit;
    await submit();
  }

  async function finalizePayBeforeOrder(method: "evc" | "edahab") {
    if (!pendingOrderId && !validateCheckoutBasics()) return;

    const existingOrderId = pendingOrderId;

    const submit = async () => {
      await runOrderSubmission({
        method,
        confirmPayment: true,
        existingOrderId,
      });
    };

    lastSubmitRef.current = submit;
    await submit();
  }

  async function handleInitiatePayment(method: "evc" | "edahab") {
    if (!validateCheckoutBasics()) return;

    setPaymentMethod(method);
    setPendingOrderId(null);
    setPlacing(method);
    setSubmitError(null);

    try {
      if (restaurant.payment_mode === "api") {
        setSubmittingOverlay(true);
        try {
          const result = await createOrder(method);
          if (!result) {
            setSubmitError("Failed to create order. Please try again.");
            return;
          }

          setPendingOrderId(result.orderId);

          const res = await fetch("/api/payments/charge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: result.orderId, method, phone }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setPendingOrderId(null);
            setSubmitError(data.error ?? "Payment failed");
            toast.error(data.error ?? "Payment failed");
            return;
          }

          setSubmittingOverlay(false);
          setPaymentDialCode("");
          setPaymentModalOpen(true);
          return;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to create order. Please try again.";
          setSubmitError(message);
          toast.error(message);
          return;
        }
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

  function handleSubmitRetry() {
    submitAbortRef.current?.abort();
    submitAbortRef.current = null;
    clearRedirectTimer();
    navigatedRef.current = false;
    redirectOrderIdRef.current = null;
    setSubmitError(null);
    setPlacing(null);

    const retry = lastSubmitRef.current;
    if (retry) {
      void retry();
      return;
    }
    if (paymentMethod) {
      void finalizePayBeforeOrder(paymentMethod);
      return;
    }
    void handlePlaceOrderWithoutPayment();
  }

  const phoneValid = isValidPhone(phone);
  const paymentDisabled =
    !isReady ||
    !!placing ||
    submittingOverlay ||
    cart.length === 0 ||
    hasUnavailableItems ||
    !phoneValid;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          overlayClassName="bg-black/50 backdrop-blur-[2px]"
          className={cn(
            "order-flow-surface mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col gap-0 overflow-hidden",
            "rounded-none border-0 bg-background p-0 text-foreground shadow-2xl",
            "sm:rounded-t-[1.75rem]"
          )}
          data-order-theme={appearance?.theme ?? "light"}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Drag hint + header */}
          <div className="shrink-0 bg-card">
            <div className="flex justify-center pt-2.5" aria-hidden="true">
              <span className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>
            <SheetHeader className="relative space-y-0 border-b border-border/60 px-5 pb-4 pt-3 pr-12 text-left">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="absolute left-4 top-3.5 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Back to menu"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <SheetTitle className="flex items-center justify-center gap-2 pl-8 text-xl font-bold tracking-tight text-foreground">
                <ShoppingBasket className="h-5 w-5" style={accentStyle} aria-hidden="true" />
                Saladda
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {/* Single scroll: cart items only */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-5">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-md">
                    <ShoppingBasket className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
                  </div>
                  <p className="text-base text-muted-foreground">Salaadu waxba kuma jiran.</p>
                </div>
              ) : showGroupedSections ? (
                <div className="space-y-7">
                  <CartSection
                    title={ORDER_TYPE_LABELS["dine-in"]}
                    items={dineInItems}
                    unavailableMenuIds={unavailableMenuIds}
                    onRemoveItem={onRemoveItem}
                    onUpdateItem={onUpdateItem}
                    onEditItem={onEditItem}
                  />
                  <CartSection
                    title={ORDER_TYPE_LABELS.takeaway}
                    items={takeawayItems}
                    unavailableMenuIds={unavailableMenuIds}
                    onRemoveItem={onRemoveItem}
                    onUpdateItem={onUpdateItem}
                    onEditItem={onEditItem}
                  />
                </div>
              ) : (
                <div className="space-y-3.5">
                  {cart.map((item) => (
                    <CartItemCard
                      key={item.cartId}
                      item={item}
                      isUnavailable={unavailableMenuIds.has(item.menuItem.id)}
                      onRemove={() => onRemoveItem(item.cartId)}
                      onEdit={() => onEditItem(item)}
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

            {/* Checkout footer — sticky, never nested-scroll */}
            {cart.length > 0 && (
              <div className="shrink-0 space-y-5 rounded-t-[1.5rem] border-t border-border/70 bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-14px_40px_rgba(15,23,42,0.12)]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cart-phone" className="text-[13px] font-semibold text-muted-foreground">
                      Lambarka taleefanka <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Phone
                        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="cart-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        placeholder="0612345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={cn(
                          "h-14 rounded-2xl border-border bg-muted/50 pl-12 pr-4",
                          "text-base leading-normal tracking-wide text-foreground",
                          "placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2"
                        )}
                        style={{
                          fontSize: 16,
                          // Prevent iOS Safari auto-zoom (requires ≥16px computed size)
                          ["--tw-ring-color" as string]: brandColorWithAlpha(accent, 0.45),
                        }}
                        aria-invalid={phone.length > 0 && !phoneValid}
                      />
                    </div>
                    {phone.length > 0 && !phoneValid && (
                      <p className="text-xs text-red-600">Geli ugu yaraan 10 digit.</p>
                    )}
                    <label className="flex cursor-pointer items-start gap-2.5 pt-1">
                      <input
                        type="checkbox"
                        checked={whatsappMarketingOptIn}
                        onChange={(e) => setWhatsappMarketingOptIn(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-[12px] leading-snug text-muted-foreground">
                        Send me occasional offers via WhatsApp
                      </span>
                    </label>
                  </div>

                  {showTableLabel && (
                    <div className="flex justify-start">
                      <span
                        className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ring-1"
                        style={{
                          backgroundColor: brandColorWithAlpha(accent, 0.12),
                          color: accent,
                          borderColor: brandColorWithAlpha(accent, 0.25),
                        }}
                      >
                        <Armchair className="h-4 w-4" aria-hidden="true" />
                        Table {tableNumber}
                      </span>
                    </div>
                  )}
                </div>

                <div
                  className="flex items-center justify-between rounded-2xl px-4 py-3.5"
                  style={{ backgroundColor: brandColorWithAlpha(accent, 0.1) }}
                >
                  <span className="text-base font-semibold text-foreground/80">Wadarta</span>
                  <span className="text-2xl font-bold tracking-tight tabular-nums" style={accentStyle}>
                    {formatCurrency(total)}
                  </span>
                </div>

                {!isReady && (
                  <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Diyaarinta…
                  </p>
                )}

                {isPayBefore ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      size="lg"
                      disabled={paymentDisabled}
                      onClick={() => handleInitiatePayment("evc")}
                      className={cn(
                        "h-14 w-full gap-2 rounded-2xl border-0 bg-[#059669] text-base font-bold text-white",
                        "shadow-[0_10px_24px_rgba(5,150,105,0.35)] transition-all duration-200",
                        "hover:bg-[#047857] active:scale-[0.98]",
                        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                      )}
                    >
                      {placing === "evc" || !isReady ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Smartphone className="h-5 w-5 shrink-0" aria-hidden="true" />
                      )}
                      {placing === "evc" ? "Sending…" : "Ku bixi EVC"}
                    </Button>

                    <Button
                      type="button"
                      size="lg"
                      disabled={paymentDisabled}
                      onClick={() => handleInitiatePayment("edahab")}
                      className={cn(
                        "h-14 w-full gap-2 rounded-2xl border-0 bg-[#D97706] text-base font-bold text-white",
                        "shadow-[0_10px_24px_rgba(217,119,6,0.35)] transition-all duration-200",
                        "hover:bg-[#B45309] active:scale-[0.98]",
                        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                      )}
                    >
                      {placing === "edahab" || !isReady ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Wallet className="h-5 w-5 shrink-0" aria-hidden="true" />
                      )}
                      {placing === "edahab" ? "Sending…" : "Ku bixi eDahab"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
                      {payAfterMessage(orderType)}
                    </p>
                    <button
                      type="button"
                      disabled={paymentDisabled}
                      onClick={handlePlaceOrderWithoutPayment}
                      className={cn(
                        "flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold",
                        "shadow-[0_10px_28px_rgba(15,23,42,0.22)] transition-all duration-200 hover:opacity-95 active:scale-[0.98]",
                        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                      )}
                      style={placeOrderStyle}
                    >
                      {placing === "place" || !isReady ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      ) : null}
                      {placing === "place" ? "Placing order…" : "Place Order"}
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

      <OrderSubmittingOverlay
        open={submittingOverlay}
        error={submitError}
        onRetry={handleSubmitRetry}
      />
    </>
  );
}
