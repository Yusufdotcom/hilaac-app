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
import { OrderStatusView } from "@/components/order/order-status-view";
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
  "flex h-[100dvh] max-h-[100dvh] min-h-screen flex-col justify-center overflow-hidden overscroll-none px-3";

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
  const [takeawayHotline, setTakeawayHotline] = useState<string | null>(null);
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
      router.replace(`/order/${params.slug}/status?orderId=${orderId}`);
    }

    setWaitingForSync(false);
  }, [isOnline, order, orderId, params.slug, router]);

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

  if (loading || waitingForSync || !restaurantName) {
    return (
      <div className={PAGE_SHELL}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          {showExtras && (
            <div className="mb-2 shrink-0">
              <OrderStatusExtras />
            </div>
          )}
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-gray-900">
            {waitingForSync || !isOnline
              ? "Waiting for connection to sync your order..."
              : "Loading your order..."}
          </p>
        </div>
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
            orderId={orderId}
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
