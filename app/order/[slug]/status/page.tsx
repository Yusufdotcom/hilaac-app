"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
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
import {
  clearPendingOrderHandoff,
  clearResolvedOrderId,
  fulfillPendingOrderHandoff,
  loadPendingOrderHandoff,
  loadResolvedOrderId,
  ORDER_CREATE_TIMEOUT_MS,
  ORDER_POLL_INTERVAL_MS,
  saveResolvedOrderId,
} from "@/lib/order/pending-order-handoff";
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

const ORDER_NOT_FOUND_ERROR = "Failed to create order. Please try again.";

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
  const [createError, setCreateError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [showRetry, setShowRetry] = useState(false);

  const fulfillStartedRef = useRef(false);

  const pendingSync = isOrderPendingSync(resolvedOrderId);
  const showRetrySync = pendingSync || !isOnline;
  const showExtras = showRetrySync || !isOnline;
  const showPreparing =
    loading ||
    waitingForSync ||
    awaitingOrder ||
    !!createError ||
    (!order && !!resolvedOrderId);

  async function handleRetrySync() {
    setRetrying(true);
    try {
      const { synced, failed } = await syncOfflineOrders();

      if (synced > 0) {
        toast.success(
          synced === 1
            ? "Dalabkaaga waa la diray!"
            : `${synced} dalabyo waa la diray!`
        );
        const supabase = createClient();
        const { data } = await supabase
          .from("orders")
          .select("id, order_number, status, payment_status, customer_confirmed_at")
          .eq("id", resolvedOrderId)
          .maybeSingle();
        if (data) setOrder(data);
      } else if (failed > 0) {
        toast.error("Isku daygu ma guuleysan. Fadlan isku day mar kale.");
      } else {
        toast.message("Ma jiro dalab sugaya in la dirayo.");
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
            Offline — dalabka waa la keydiyay
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

  const fetchOrderById = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, status, payment_status, customer_confirmed_at")
      .eq("id", id)
      .maybeSingle();
    return data;
  }, []);

  useEffect(() => {
    setResolvedOrderId(orderId);
    setOrder(null);
    setLoading(true);
    setCreateError(null);
    setAwaitingOrder(false);
    setShowRetry(false);
    fulfillStartedRef.current = false;
  }, [orderId, retryNonce]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchRestaurant() {
      const [restaurantRes, brandingRes] = await Promise.all([
        supabase
          .from("restaurants")
          .select("name, is_active, takeaway_hotline")
          .eq("slug", params.slug)
          .maybeSingle(),
        fetch(`/api/restaurants/${params.slug}/branding`, { cache: "no-store" }),
      ]);

      const { data } = restaurantRes;
      if (!data?.is_active) return;

      setRestaurantName(data.name);
      setTakeawayHotline(data.takeaway_hotline ?? null);

      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();
        setBranding(brandingData);
        if (brandingData.takeaway_hotline) {
          setTakeawayHotline(brandingData.takeaway_hotline);
        }
      }
    }

    void fetchRestaurant();
  }, [params.slug]);

  // Safety-net Retry after 5s while still waiting.
  useEffect(() => {
    if (order || createError) {
      setShowRetry(!!createError);
      return;
    }
    if (!showPreparing) return;
    const timer = window.setTimeout(() => setShowRetry(true), ORDER_CREATE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [order, createError, showPreparing, retryNonce]);

  // Pending handoff / resolved mapping from the 3s redirect path.
  useEffect(() => {
    if (!orderId) return;

    const handoff = loadPendingOrderHandoff(orderId);
    const alreadyResolved = loadResolvedOrderId(orderId);
    if (!isPendingParam && !handoff && !alreadyResolved) return;
    if (fulfillStartedRef.current) return;
    fulfillStartedRef.current = true;

    setAwaitingOrder(true);
    setLoading(true);
    setCreateError(null);

    const controller = new AbortController();
    let cancelled = false;

    async function adoptRealId(realId: string) {
      clearPendingOrderHandoff(orderId);
      clearResolvedOrderId(orderId);
      setResolvedOrderId(realId);
      const data = await fetchOrderById(realId);
      if (cancelled) return;
      if (data) setOrder(data);
      setAwaitingOrder(false);
      setLoading(false);
      window.location.replace(`/order/${params.slug}/status?orderId=${realId}`);
    }

    void (async () => {
      try {
        // Prefer an id the cart already created (avoids double insert).
        let realId = loadResolvedOrderId(orderId);
        if (!realId) {
          const waitUntil = Date.now() + ORDER_CREATE_TIMEOUT_MS;
          while (!realId && Date.now() < waitUntil) {
            if (cancelled) return;
            await new Promise((r) => window.setTimeout(r, 400));
            realId = loadResolvedOrderId(orderId);
          }
        }

        if (realId) {
          await adoptRealId(realId);
          return;
        }

        const activeHandoff = loadPendingOrderHandoff(orderId);
        if (!activeHandoff) {
          throw new Error(ORDER_NOT_FOUND_ERROR);
        }

        // Fallback: cart create failed / never finished — create from handoff once.
        const created = await fulfillPendingOrderHandoff(activeHandoff, {
          signal: controller.signal,
        });
        if (cancelled) return;
        saveResolvedOrderId(orderId, created.orderId);
        await adoptRealId(created.orderId);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : ORDER_NOT_FOUND_ERROR;
        setCreateError(message);
        setAwaitingOrder(false);
        setLoading(false);
        setShowRetry(true);
      }
    })();

    return () => {
      cancelled = true;
      fulfillStartedRef.current = false;
      controller.abort();
    };
  }, [orderId, isPendingParam, params.slug, fetchOrderById, retryNonce]);

  // Normal lookup / poll when not on the pending-handoff path.
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
      const data = await fetchOrderById(orderId);
      if (cancelled) return false;
      if (data) {
        found = true;
        setOrder(data);
        setAwaitingOrder(false);
        setLoading(false);
        setCreateError(null);
        return true;
      }
      return false;
    }

    void (async () => {
      if (await lookup()) return;
      if (cancelled) return;

      interval = window.setInterval(async () => {
        if (cancelled) return;
        if (await lookup()) {
          if (interval !== undefined) window.clearInterval(interval);
        }
      }, ORDER_POLL_INTERVAL_MS);
    })();

    const failTimer = window.setTimeout(() => {
      if (cancelled || found) return;
      setCreateError(ORDER_NOT_FOUND_ERROR);
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

      const supabase = createClient();
      const interval = window.setInterval(async () => {
        const { data } = await supabase
          .from("orders")
          .select("id, order_number, status, payment_status, customer_confirmed_at")
          .eq("id", resolvedOrderId)
          .maybeSingle();

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
  }, [isOnline, order, resolvedOrderId, params.slug, router]);

  function handleCreateRetry() {
    fulfillStartedRef.current = false;
    setCreateError(null);
    setShowRetry(false);
    setRetryNonce((n) => n + 1);
  }

  if (!orderId) {
    return (
      <div className={PAGE_SHELL}>
        <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          Order not found.
        </div>
        <PoweredByHilaac className="shrink-0 pb-2" />
      </div>
    );
  }

  if (showPreparing && !order) {
    return (
      <div className={PAGE_SHELL}>
        <OrderBrandProvider
          brandColor={branding.brand_color}
          customBrandingEnabled={branding.custom_branding_enabled ?? false}
          accentColor={branding.customerAccentColor}
          fullHeight={false}
        >
          <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center">
            {showExtras && !createError && (
              <div className="mb-2 shrink-0">
                <OrderStatusExtras />
              </div>
            )}
            <OrderPreparingScreen
              message={
                waitingForSync || !isOnline
                  ? "Waiting for connection to sync your order..."
                  : "Halaalabkaaga waa la diyaarinayaa..."
              }
              submessage={createError ? undefined : "Fadlan sug…"}
              error={createError}
              onRetry={showRetry || createError ? handleCreateRetry : undefined}
            />
          </div>
        </OrderBrandProvider>
        <PoweredByHilaac className="shrink-0 pb-2" />
      </div>
    );
  }

  if (!restaurantName || !order) {
    return (
      <div className={PAGE_SHELL}>
        <OrderBrandProvider
          brandColor={branding.brand_color}
          customBrandingEnabled={branding.custom_branding_enabled ?? false}
          accentColor={branding.customerAccentColor}
          fullHeight={false}
        >
          <OrderPreparingScreen
            message="Halaalabkaaga waa la diyaarinayaa..."
            submessage="Fadlan sug…"
            onRetry={showRetry ? handleCreateRetry : undefined}
          />
        </OrderBrandProvider>
        <PoweredByHilaac className="shrink-0 pb-2" />
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
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
    </div>
  );
}
