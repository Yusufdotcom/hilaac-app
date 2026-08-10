"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import {
  getQueue,
  isOrderPendingSync,
  removeQueuedOrderByOrderId,
  syncOfflineOrders,
} from "@/lib/offline-queue";
import { OrderBrandProvider } from "@/components/order/order-brand-context";
import { OrderPreparingScreen } from "@/components/order/order-preparing-screen";
import { OrderStatusView } from "@/components/order/order-status-view";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  beginFulfillLock,
  clearPendingOrderHandoff,
  clearResolvedOrderId,
  completeFulfillLock,
  fulfillPendingOrderHandoff,
  isPendingTempOrderId,
  loadPendingOrderHandoff,
  loadResolvedOrderId,
  ORDER_CREATE_TIMEOUT_MS,
  ORDER_POLL_INTERVAL_MS,
  releaseFulfillLock,
  saveResolvedOrderId,
} from "@/lib/order/pending-order-handoff";
import { loadOrderAccessToken, saveOrderTokens } from "@/lib/order/order-access-storage";
import { OrderAppearanceProvider } from "@/components/order/order-appearance-context";
import { isOrderAccessError } from "@/components/order/order-preparing-screen";
import type { PaymentStatus } from "@/types/database";

interface TrackedOrderRow {
  id: string;
  order_number: number | null;
  status: string;
  payment_status: PaymentStatus;
  customer_confirmed_at: string | null;
}

const PAGE_SHELL =
  "flex h-[100dvh] max-h-[100dvh] min-h-screen flex-col justify-center overflow-hidden overscroll-none px-3";

const ORDER_NOT_FOUND_ERROR = "Could not load order status. Please try again.";

export default function OrderStatusPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { orderId?: string; pending?: string };
}) {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const orderId = searchParams.orderId ?? "";
  const isPendingParam = searchParams.pending === "1";

  const [order, setOrder] = useState<TrackedOrderRow | null>(null);
  const [resolvedOrderId, setResolvedOrderId] = useState(orderId);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [takeawayHotline, setTakeawayHotline] = useState<string | null>(null);
  const [branding, setBranding] = useState<{
    brand_color?: string | null;
    custom_branding_enabled?: boolean;
    customerAccentColor?: string;
  }>({});
  const [waitingForSync, setWaitingForSync] = useState(false);
  const [loading, setLoading] = useState(true);
  const [awaitingOrder, setAwaitingOrder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [showRetry, setShowRetry] = useState(false);

  const pendingSync = isOrderPendingSync(resolvedOrderId);
  const showRetrySync = pendingSync || !isOnline;
  const showExtras = showRetrySync || !isOnline;
  const showPreparing =
    loading ||
    waitingForSync ||
    awaitingOrder ||
    !!loadError ||
    (!order && !!resolvedOrderId);

  /** Track API requires order access token (localStorage) or staff session. */
  const fetchOrderById = useCallback(async (id: string) => {
    const accessToken = loadOrderAccessToken(id);
    const url = accessToken
      ? `/api/orders/${id}/track?accessToken=${encodeURIComponent(accessToken)}`
      : `/api/orders/${id}/track`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.order) {
      const apiError = typeof data.error === "string" ? data.error : null;
      if (res.status === 401 || res.status === 403) {
        return {
          order: null as TrackedOrderRow | null,
          error:
            apiError ??
            "To view this order on a new device, re-enter the phone number used when you ordered.",
          accessDenied: true as const,
          status: res.status,
        };
      }
      return {
        order: null as TrackedOrderRow | null,
        error: apiError ?? ORDER_NOT_FOUND_ERROR,
        accessDenied: false as const,
        status: res.status,
      };
    }
    return {
      order: data.order as TrackedOrderRow,
      error: null,
      accessDenied: false as const,
      status: res.status,
    };
  }, []);

  const recoverOrderAccess = useCallback(
    async (phone: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const id = resolvedOrderId || orderId;
      if (!id) return { ok: false, error: "Order not found." };

      const res = await fetch(`/api/orders/${id}/recover-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.accessToken !== "string") {
        return {
          ok: false,
          error:
            typeof data.error === "string"
              ? data.error
              : "Phone number does not match this order.",
        };
      }

      saveOrderTokens(id, { accessToken: data.accessToken });
      const tracked = await fetchOrderById(id);
      if (!tracked.order) {
        return {
          ok: false,
          error: tracked.error ?? "Could not load order status after verification.",
        };
      }

      setOrder(tracked.order);
      setResolvedOrderId(id);
      setLoadError(null);
      setAwaitingOrder(false);
      setLoading(false);
      setShowRetry(false);
      return { ok: true };
    },
    [resolvedOrderId, orderId, fetchOrderById]
  );

  async function handleRetrySync() {
    setRetrying(true);
    try {
      const { synced, failed } = await syncOfflineOrders();

      if (synced > 0) {
        toast.success(
          synced === 1
            ? "Dalabkaaga waa la diray!"
            : `${synced} dalabka waa la diray!`
        );
        const { order: data } = await fetchOrderById(resolvedOrderId);
        if (data) setOrder(data);
      } else if (failed > 0) {
        toast.error("Isku daygaga ma guuleysan. Fadlan isku day mar kale.");
      } else {
        toast.message("Ma jiro dalab sugaya in la diro.");
      }
    } finally {
      setRetrying(false);
    }
  }

  function OrderStatusExtras() {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-1">
        {!isOnline && (
          <Badge className="gap-1 border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] text-amber-900 hover:bg-amber-100">
            <WifiOff className="h-3 w-3" aria-hidden="true" />
            Offline — Dalabkaaga waa la keydiyay
          </Badge>
        )}
        {showRetrySync && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={retrying}
            onClick={() => void handleRetrySync()}
            className="h-7 border-amber-200 px-2.5 text-[10px] text-amber-900 hover:bg-amber-50"
          >
            {retrying ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            Isku day mar kale
          </Button>
        )}
      </div>
    );
  }

  useEffect(() => {
    setResolvedOrderId(orderId);
    setOrder(null);
    setLoading(true);
    setLoadError(null);
    setAwaitingOrder(false);
    setShowRetry(false);
  }, [orderId, retryNonce]);

  // Restaurant context via public branding API (service role) — no client RLS.
  useEffect(() => {
    async function fetchRestaurant() {
      try {
        const brandingRes = await fetch(`/api/restaurants/${params.slug}/branding`, {
          cache: "no-store",
        });
        if (!brandingRes.ok) {
          setLoadError("Restaurant not found or inactive.");
          setLoading(false);
          setShowRetry(true);
          return;
        }
        const brandingData = await brandingRes.json();
        setBranding(brandingData);
        if (brandingData.name) setRestaurantName(brandingData.name);
        if (brandingData.takeaway_hotline) {
          setTakeawayHotline(brandingData.takeaway_hotline);
        }
      } catch {
        setLoadError("Could not load restaurant details.");
        setShowRetry(true);
      }
    }

    void fetchRestaurant();
  }, [params.slug]);

  useEffect(() => {
    if (order || loadError) {
      setShowRetry(!!loadError);
      return;
    }
    if (!showPreparing) return;
    const timer = window.setTimeout(() => setShowRetry(true), ORDER_CREATE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [order, loadError, showPreparing, retryNonce]);

  // Pending handoff: Status is the sole creator. Module lock prevents Strict Mode double POST.
  useEffect(() => {
    if (!orderId) return;

    const handoff = loadPendingOrderHandoff(orderId);
    const alreadyResolved = loadResolvedOrderId(orderId);
    const looksPending = isPendingParam || isPendingTempOrderId(orderId);
    if (!looksPending && !handoff && !alreadyResolved) return;

    setAwaitingOrder(true);
    setLoading(true);
    setLoadError(null);

    let cancelled = false;

    async function adoptRealId(realId: string) {
      clearPendingOrderHandoff(orderId);
      clearResolvedOrderId(orderId);
      completeFulfillLock(orderId);
      setResolvedOrderId(realId);
      const { order: data, error } = await fetchOrderById(realId);
      if (cancelled) return;
      if (data) {
        setOrder(data);
        setAwaitingOrder(false);
        setLoading(false);
        // Never leave a pending-* id in the address bar.
        if (realId !== orderId) {
          window.location.replace(`/order/${params.slug}/status?orderId=${realId}`);
        }
        return;
      }
      setLoadError(error ?? ORDER_NOT_FOUND_ERROR);
      setAwaitingOrder(false);
      setLoading(false);
      setShowRetry(true);
    }

    void (async () => {
      try {
        let realId = loadResolvedOrderId(orderId);
        if (realId) {
          await adoptRealId(realId);
          return;
        }

        // Acquire create lock before fulfill — remounts must not insert again.
        if (!beginFulfillLock(orderId)) {
          // Another effect already creating — poll until resolved or timeout.
          const waitUntil = Date.now() + ORDER_CREATE_TIMEOUT_MS;
          while (!realId && Date.now() < waitUntil) {
            if (cancelled) return;
            await new Promise((r) => window.setTimeout(r, 300));
            realId = loadResolvedOrderId(orderId);
          }
          if (realId) {
            await adoptRealId(realId);
            return;
          }
          throw new Error(ORDER_NOT_FOUND_ERROR);
        }

        const activeHandoff = loadPendingOrderHandoff(orderId);
        if (!activeHandoff) {
          releaseFulfillLock(orderId);
          throw new Error(ORDER_NOT_FOUND_ERROR);
        }

        const created = await fulfillPendingOrderHandoff(activeHandoff);
        saveResolvedOrderId(orderId, created.orderId);
        await adoptRealId(created.orderId);
      } catch (err) {
        releaseFulfillLock(orderId);
        if (cancelled) return;
        const message = err instanceof Error ? err.message : ORDER_NOT_FOUND_ERROR;
        setLoadError(message);
        setAwaitingOrder(false);
        setLoading(false);
        setShowRetry(true);
      }
    })();

    return () => {
      // Do not abort in-flight create / reset locks — that caused duplicate orders.
      cancelled = true;
    };
  }, [orderId, isPendingParam, params.slug, fetchOrderById, retryNonce]);

  // Normal lookup via track API (no client-side orders SELECT / RLS).
  useEffect(() => {
    if (!orderId) return;
    if (isPendingParam || loadPendingOrderHandoff(orderId) || loadResolvedOrderId(orderId)) {
      return;
    }

    let cancelled = false;
    let interval: number | undefined;
    let found = false;

    setAwaitingOrder(true);
    setLoading(false);

    async function lookup() {
      const { order: data, error, accessDenied } = await fetchOrderById(orderId);
      if (cancelled) return "stop" as const;
      if (data) {
        found = true;
        setOrder(data);
        setAwaitingOrder(false);
        setLoading(false);
        setLoadError(null);
        return "found" as const;
      }
      if (accessDenied || isOrderAccessError(error)) {
        setLoadError(error ?? ORDER_NOT_FOUND_ERROR);
        setAwaitingOrder(false);
        setLoading(false);
        setShowRetry(true);
        return "stop" as const;
      }
      // Keep polling briefly — order may still be committing.
      return "retry" as const;
    }

    void (async () => {
      const first = await lookup();
      if (first !== "retry" || cancelled) return;

      interval = window.setInterval(async () => {
        if (cancelled) return;
        const result = await lookup();
        if (result !== "retry" && interval !== undefined) {
          window.clearInterval(interval);
        }
      }, ORDER_POLL_INTERVAL_MS);
    })();

    const failTimer = window.setTimeout(() => {
      if (cancelled || found) return;
      setLoadError((prev) => prev ?? ORDER_NOT_FOUND_ERROR);
      setAwaitingOrder(false);
      setShowRetry(true);
      if (interval !== undefined) window.clearInterval(interval);
    }, ORDER_CREATE_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
      window.clearTimeout(failTimer);
    };
  }, [orderId, isPendingParam, fetchOrderById, retryNonce]);

  useEffect(() => {
    const pendingInQueue = isOrderPendingSync(resolvedOrderId);

    if (!isOnline) {
      setWaitingForSync(pendingInQueue);
      return;
    }

    if (!pendingInQueue) {
      setWaitingForSync(false);
      return;
    }

    if (!order) {
      setWaitingForSync(true);

      const interval = window.setInterval(async () => {
        const { order: data } = await fetchOrderById(resolvedOrderId);
        if (data) {
          setOrder(data);
          window.clearInterval(interval);
        }
      }, ORDER_POLL_INTERVAL_MS);

      return () => window.clearInterval(interval);
    }

    const queue = getQueue();
    const wasQueued = queue.some(
      (item) =>
        !item.synced &&
        (item.localOrderId === resolvedOrderId || item.serverOrderId === resolvedOrderId)
    );

    if (wasQueued && order) {
      removeQueuedOrderByOrderId(resolvedOrderId);
      router.replace(`/order/${params.slug}/status?orderId=${resolvedOrderId}`);
    }

    setWaitingForSync(false);
  }, [isOnline, order, resolvedOrderId, params.slug, router, fetchOrderById]);

  function handleCreateRetry() {
    releaseFulfillLock(orderId);
    setLoadError(null);
    setShowRetry(false);
    setRetryNonce((n) => n + 1);
  }

  const shell = (children: ReactNode) => (
    <OrderAppearanceProvider>
      <div className={cn(PAGE_SHELL, "bg-background text-foreground")}>{children}</div>
    </OrderAppearanceProvider>
  );

  if (!orderId) {
    return shell(
      <>
        <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          Order not found.
        </div>
        <PoweredByHilaac className="shrink-0 pb-2" />
      </>
    );
  }

  if (showPreparing && !order) {
    return shell(
      <>
        <OrderBrandProvider
          brandColor={branding.brand_color}
          customBrandingEnabled={branding.custom_branding_enabled ?? false}
          accentColor={branding.customerAccentColor}
          fullHeight={false}
        >
          <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center">
            {showExtras && !loadError && (
              <div className="mb-2 shrink-0">
                <OrderStatusExtras />
              </div>
            )}
            <OrderPreparingScreen
              message={
                waitingForSync || !isOnline
                  ? "Waiting for connection to sync your order..."
                  : "Dalabkaga waa la diyaarinayaa..."
              }
              submessage={loadError ? undefined : "Fadlan aayar sug…"}
              error={loadError}
              onRetry={showRetry || loadError ? handleCreateRetry : undefined}
              onRecoverAccess={loadError ? recoverOrderAccess : undefined}
            />
          </div>
        </OrderBrandProvider>
        <PoweredByHilaac className="shrink-0 pb-2" />
      </>
    );
  }

  if (!restaurantName || !order) {
    return shell(
      <>
        <OrderBrandProvider
          brandColor={branding.brand_color}
          customBrandingEnabled={branding.custom_branding_enabled ?? false}
          accentColor={branding.customerAccentColor}
          fullHeight={false}
        >
          <OrderPreparingScreen
            message="Dalabkaga waa la diyaarinayaa..."
            submessage="Fadlan sug…"
            error={loadError}
            onRetry={showRetry || loadError ? handleCreateRetry : undefined}
            onRecoverAccess={loadError ? recoverOrderAccess : undefined}
          />
        </OrderBrandProvider>
        <PoweredByHilaac className="shrink-0 pb-2" />
      </>
    );
  }

  return shell(
    <>
      {showExtras && (
        <div className="mx-auto w-full max-w-sm shrink-0 pt-1">
          <OrderStatusExtras />
        </div>
      )}

      <OrderBrandProvider
        brandColor={branding.brand_color}
        customBrandingEnabled={branding.custom_branding_enabled ?? false}
        accentColor={branding.customerAccentColor}
        fullHeight={false}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center overflow-hidden">
          <OrderStatusView
            orderId={resolvedOrderId}
            restaurantName={restaurantName}
            takeawayHotline={takeawayHotline}
            newOrderHref={`/order/${params.slug}`}
          />
        </div>
      </OrderBrandProvider>

      <PoweredByHilaac className="mx-auto shrink-0 pb-2 pt-1" />
    </>
  );
}
