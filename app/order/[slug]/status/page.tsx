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
  fulfillPendingOrderHandoff,
  loadPendingOrderHandoff,
  ORDER_CREATE_TIMEOUT_MS,
  ORDER_POLL_INTERVAL_MS,
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

  // Optimistic handoff: create order from sessionStorage, then swap to real id.
  useEffect(() => {
    if (!orderId) return;

    const handoff = loadPendingOrderHandoff(orderId);
    const shouldFulfill = isPendingParam || !!handoff;
    if (!shouldFulfill || !handoff) {
      return;
    }

    if (fulfillStartedRef.current) return;
    fulfillStartedRef.current = true;

    setAwaitingOrder(true);
    setLoading(true);
    setCreateError(null);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), ORDER_CREATE_TIMEOUT_MS);
    let cancelled = false;

    void (async () => {
      try {
        const { orderId: realId } = await fulfillPendingOrderHandoff(handoff, {
          signal: controller.signal,
        });
        if (cancelled) return;
        clearPendingOrderHandoff(orderId);
        setResolvedOrderId(realId);
        const data = await fetchOrderById(realId);
        if (cancelled) return;
        if (data) setOrder(data);
        setAwaitingOrder(false);
        setLoading(false);
        router.replace(`/order/${params.slug}/status?orderId=${realId}`);
      } catch (err) {
        if (cancelled) return;
        // Keep handoff so "Isku day mar kale" can retry create.
        const message =
          err instanceof Error && err.name === "AbortError"
            ? ORDER_NOT_FOUND_ERROR
            : err instanceof Error
              ? err.message
              : ORDER_NOT_FOUND_ERROR;
        setCreateError(message);
        setAwaitingOrder(false);
        setLoading(false);
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      fulfillStartedRef.current = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [orderId, isPendingParam, params.slug, router, fetchOrderById, retryNonce]);

  // Normal / poll path when not fulfilling a handoff.
  useEffect(() => {
    if (!orderId) return;
    if (loadPendingOrderHandoff(orderId)) return;

    let cancelled = false;
    let interval: number | undefined;
    const startedAt = Date.now();

    async function lookup() {
      const data = await fetchOrderById(orderId);
      if (cancelled) return false;

      if (data) {
        setOrder(data);
        setAwaitingOrder(false);
        setLoading(false);
        setCreateError(null);
        return true;
      }
      return false;
    }

    setAwaitingOrder(true);
    setLoading(false);

    void (async () => {
      const found = await lookup();
      if (cancelled || found) return;

      interval = window.setInterval(async () => {
        if (cancelled) return;
        const foundNow = await lookup();
        if (foundNow) {
          if (interval !== undefined) window.clearInterval(interval);
          return;
        }
        if (Date.now() - startedAt >= ORDER_CREATE_TIMEOUT_MS) {
          if (interval !== undefined) window.clearInterval(interval);
          if (!cancelled) {
            setCreateError(ORDER_NOT_FOUND_ERROR);
            setAwaitingOrder(false);
            setLoading(false);
          }
        }
      }, ORDER_POLL_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [orderId, fetchOrderById, retryNonce]);

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
              submessage={
                createError
                  ? undefined
                  : waitingForSync || !isOnline
                    ? undefined
                    : "Fadlan sug…"
              }
              error={createError}
              onRetry={createError ? handleCreateRetry : undefined}
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
          <OrderPreparingScreen message="Halaalabkaaga waa la diyaarinayaa..." submessage="Fadlan sug…" />
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
