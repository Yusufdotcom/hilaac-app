"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OrderBrandProvider } from "@/components/order/order-brand-context";
import { PaymentConfirmationModal } from "@/components/order/payment-confirmation-modal";
import type { CreateOrderApiPayload } from "@/lib/offline-queue";

/**
 * Payment screen (Saladda) — opened after an offline order syncs so the
 * customer can confirm USSD payment.
 */
export default function SaladdaPaymentPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [ready, setReady] = useState(false);
  const [ussdCode, setUssdCode] = useState("");
  const [createPayload, setCreatePayload] = useState<CreateOrderApiPayload | null>(null);
  const [branding, setBranding] = useState<{
    brand_color?: string | null;
    custom_branding_enabled?: boolean;
  }>({});

  useEffect(() => {
    if (!orderId) return;

    async function loadOrderContext() {
      const supabase = createClient();

      const [trackRes, { data: restaurant }] = await Promise.all([
        fetch(`/api/orders/${orderId}/track`, { cache: "no-store" }),
        supabase
          .from("restaurants")
          .select("id, evc_ussd_code, edahab_ussd_code, brand_color, custom_branding_enabled")
          .eq("slug", params.slug)
          .maybeSingle(),
      ]);

      if (!trackRes.ok || !restaurant) {
        setReady(true);
        return;
      }

      const { order } = await trackRes.json();

      if (order.payment_status === "paid") {
        router.replace(`/order/${params.slug}/status?orderId=${orderId}`);
        return;
      }

      setBranding({
        brand_color: restaurant.brand_color,
        custom_branding_enabled: restaurant.custom_branding_enabled,
      });
      setUssdCode(restaurant.evc_ussd_code ?? "");

      setCreatePayload({
        restaurantId: restaurant.id,
        tableId: null,
        orderType: order.order_type ?? "takeaway",
        paymentMethod: "evc",
        items: [],
      });
      setReady(true);
    }

    void loadOrderContext();
  }, [orderId, params.slug, router]);

  if (!orderId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Order not found.
      </div>
    );
  }

  if (!ready || !createPayload) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <OrderBrandProvider
      brandColor={branding.brand_color}
      customBrandingEnabled={branding.custom_branding_enabled ?? false}
    >
      <PaymentConfirmationModal
        open
        orderIds={[orderId]}
        slug={params.slug}
        ussdCode={ussdCode}
        createPayloads={[createPayload]}
        onClose={() => router.push(`/order/${params.slug}/status?orderId=${orderId}`)}
      />
    </OrderBrandProvider>
  );
}
