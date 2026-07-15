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
import { OrderConfirmation } from "@/components/order/order-confirmation";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PaymentStatus } from "@/types/database";

interface TrackedOrderRow {
  id: string;
  status: string;
  payment_status: PaymentStatus;
}

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
  const [waitingForSync, setWaitingForSync] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const pendingSync = isOrderPendingSync(orderId);
  const showRetrySync = pendingSync || !isOnline;

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
          .select("id, status, payment_status")
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
      <div className="flex w-full max-w-sm flex-col items-center gap-2 px-4">
        {!isOnline && (
          <Badge className="gap-1.5 border-amber-200 bg-amber-100 px-3 py-1.5 text-amber-900 hover:bg-amber-100">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
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
            className="border-amber-200 text-amber-900 hover:bg-amber-50"
          >
            {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Isku day mar kale
          </Button>
        )}
      </div>
    );
  }

  // Load restaurant name for the status UI.
  useEffect(() => {
    const supabase = createClient();

    async function fetchRestaurant() {
      const { data } = await supabase
        .from("restaurants")
        .select("name, is_active")
        .eq("slug", params.slug)
        .maybeSingle();

      if (!data?.is_active) return;
      setRestaurantName(data.name);
    }

    void fetchRestaurant();
  }, [params.slug]);

  // Fetch the order from Supabase (RLS allows anon read on recent orders).
  useEffect(() => {
    const supabase = createClient();

    async function fetchOrder() {
      const { data } = await supabase
        .from("orders")
        .select("id, status, payment_status")
        .eq("id", orderId)
        .maybeSingle();

      setOrder(data);
      setLoading(false);
    }

    void fetchOrder();
  }, [orderId]);

  // Auto-redirect to the payment screen once sync completes.
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

    // Still in the offline queue — keep polling until the order appears in Supabase.
    if (!order) {
      setWaitingForSync(true);

      const supabase = createClient();
      const interval = window.setInterval(async () => {
        const { data } = await supabase
          .from("orders")
          .select("id, status, payment_status")
          .eq("id", orderId)
          .maybeSingle();

        if (data) {
          setOrder(data);
          window.clearInterval(interval);
        }
      }, 2000);

      return () => window.clearInterval(interval);
    }

    // Order exists in DB and was previously queued — redirect to payment.
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
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Order not found.
      </div>
    );
  }

  if (loading || waitingForSync || !restaurantName) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
        <OrderStatusExtras />
        <Loader2 className="mb-4 mt-4 h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-lg font-medium text-[#0F172A]">
          {waitingForSync || !isOnline
            ? "Waiting for connection to sync your order..."
            : "Loading your order..."}
        </p>
        {!isOnline && (
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Your order is saved on this device and will sync automatically when you reconnect.
          </p>
        )}
        <PoweredByHilaac className="mt-auto pt-10" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex justify-center pt-4">
        <OrderStatusExtras />
      </div>
      <OrderConfirmation
        orderId={orderId}
        restaurant={{ name: restaurantName }}
        newOrderHref={`/order/${params.slug}`}
      />
    </div>
  );
}
