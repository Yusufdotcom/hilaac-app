"use client";

import { useEffect, useState } from "react";
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
import { OrderConfirmation } from "@/components/order/order-confirmation";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PaymentStatus } from "@/types/database";

interface TrackedOrderRow {
  id: string;
  order_number: number | null;
  status: string;
  payment_status: PaymentStatus;
  customer_confirmed_at: string | null;
}

const PAGE_SHELL =
  "flex h-[100dvh] max-h-[100dvh] min-h-[100dvh] flex-col items-center overflow-hidden px-4";

export default function OrderStatusPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { orderId?: string };
}) {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const orderId = searchParams.orderId ?? "";

  const [order, setOrder] = useState<TrackedOrderRow | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [branding, setBranding] = useState<{
    brand_color?: string | null;
    custom_branding_enabled?: boolean;
    customerAccentColor?: string;
  }>({});
  const [waitingForSync, setWaitingForSync] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const pendingSync = isOrderPendingSync(orderId);
  const showRetrySync = pendingSync || !isOnline;
  const showExtras = showRetrySync || !isOnline;

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
          .eq("id", orderId)
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
      <div className="flex w-full max-w-sm flex-col items-center gap-1.5">
        {!isOnline && (
          <Badge className="gap-1 border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 hover:bg-amber-100">
            <WifiOff className="h-3 w-3" aria-hidden="true" />
            Mode Offline - Dalabka waa la keydiyay
          </Badge>
        )}
        {showRetrySync && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={retrying}
            onClick={() => void handleRetrySync()}
            className="h-8 border-amber-200 px-3 text-xs text-amber-900 hover:bg-amber-50"
          >
            {retrying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            Isku day mar kale
          </Button>
        )}
      </div>
    );
  }

  useEffect(() => {
    const supabase = createClient();

    async function fetchRestaurant() {
      const [restaurantRes, brandingRes] = await Promise.all([
        supabase
          .from("restaurants")
          .select("name, is_active")
          .eq("slug", params.slug)
          .maybeSingle(),
        fetch(`/api/restaurants/${params.slug}/branding`, { cache: "no-store" }),
      ]);

      const { data } = restaurantRes;
      if (!data?.is_active) return;

      setRestaurantName(data.name);

      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();
        setBranding(brandingData);
      }
    }

    void fetchRestaurant();
  }, [params.slug]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchOrder() {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, customer_confirmed_at")
        .eq("id", orderId)
        .maybeSingle();

      setOrder(data);
      setLoading(false);
    }

    void fetchOrder();
  }, [orderId]);

  useEffect(() => {
    const pendingInQueue = isOrderPendingSync(orderId);

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
          .eq("id", orderId)
          .maybeSingle();

        if (data) {
          setOrder(data);
          window.clearInterval(interval);
        }
      }, 2000);

      return () => window.clearInterval(interval);
    }

    const queue = getQueue();
    const wasQueued = queue.some(
      (item) =>
        !item.synced &&
        (item.localOrderId === orderId || item.serverOrderId === orderId)
    );

    if (wasQueued && order) {
      removeQueuedOrderByOrderId(orderId);
      router.push(`/order/${params.slug}/saladda?orderId=${orderId}`);
    }

    setWaitingForSync(false);
  }, [isOnline, order, orderId, params.slug, router]);

  if (!orderId) {
    return (
      <div className={PAGE_SHELL}>
        <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          Order not found.
        </div>
        <PoweredByHilaac className="mt-auto shrink-0 pb-2" />
      </div>
    );
  }

  if (loading || waitingForSync || !restaurantName) {
    return (
      <div className={PAGE_SHELL}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          {showExtras && (
            <div className="mb-3 shrink-0">
              <OrderStatusExtras />
            </div>
          )}
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-base font-medium leading-tight text-[#0F172A]">
            {waitingForSync || !isOnline
              ? "Waiting for connection to sync your order..."
              : "Loading your order..."}
          </p>
          {!isOnline && (
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Your order is saved on this device and will sync automatically when you reconnect.
            </p>
          )}
        </div>
        <PoweredByHilaac className="mt-auto shrink-0 pb-2" />
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
      {showExtras && (
        <div className="w-full max-w-sm shrink-0 pt-2">
          <OrderStatusExtras />
        </div>
      )}
      <OrderBrandProvider
        brandColor={branding.brand_color}
        customBrandingEnabled={branding.custom_branding_enabled ?? false}
        accentColor={branding.customerAccentColor}
      >
        <OrderConfirmation
          orderId={orderId}
          restaurant={{ name: restaurantName }}
          newOrderHref={`/order/${params.slug}`}
          compact
          openNewOrderInNewTab
          className="w-full max-w-sm"
        />
      </OrderBrandProvider>
    </div>
  );
}
