"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import {
  createQueueId,
  queueOrder,
  type CreateOrderApiPayload,
} from "@/lib/offline-queue";
import { OrderPrimaryButton } from "@/components/order/order-primary-button";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import { customerPrimaryButtonStyle } from "@/lib/brand/restaurant-brand";
import { Button } from "@/components/ui/button";

export function PaymentConfirmationModal({
  open,
  orderIds = [],
  slug,
  ussdCode,
  createPayloads = [],
  onClose,
  onCustomerConfirmed,
  deferNavigation = false,
}: {
  open: boolean;
  orderIds?: string[];
  slug: string;
  ussdCode: string;
  createPayloads?: CreateOrderApiPayload[];
  onClose: () => void;
  /** Called when the customer confirms payment before an order exists (pay-before USSD flow). */
  onCustomerConfirmed?: () => void;
  /** When true, stay on checkout and let the parent handle navigation (Place Order flow). */
  deferNavigation?: boolean;
}) {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const brand = useOrderBrandOptional();
  const primaryOrderId = orderIds[0];
  const confirmStyle = brand
    ? customerPrimaryButtonStyle(brand.restaurant)
    : customerPrimaryButtonStyle({});

  useEffect(() => setMounted(true), []);

  async function handlePaymentConfirmed() {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      if (orderIds.length === 0) {
        onCustomerConfirmed?.();
        onClose();
        return;
      }

      if (!isOnline) {
        createPayloads.forEach((payload, index) => {
          queueOrder({
            id: createQueueId(),
            slug,
            payload,
            localOrderId: orderIds[index] ?? primaryOrderId,
            serverOrderId: orderIds[index],
            confirmPayment: true,
          });
        });
        toast.message("Dalabka waa la keydiyay. Cashier-ka ayaa xaqiijin doona markaad isku xirto.");
        onClose();
        router.push(`/order/${slug}/status?orderId=${primaryOrderId}`);
        return;
      }

      for (const orderId of orderIds) {
        const confirmRes = await fetch(`/api/orders/${orderId}/confirm-payment`, {
          method: "POST",
        });

        if (!confirmRes.ok) {
          const data = await confirmRes.json().catch(() => ({}));
          toast.error(data.error ?? "Lacag bixinta lama xaqiijin karin");
          return;
        }
      }

      toast.success("Lacag bixinta waa la diray. Cashier-ka ayaa xaqiijin doona.");
      onCustomerConfirmed?.();
      onClose();
      if (!deferNavigation) {
        router.push(`/order/${slug}/status?orderId=${primaryOrderId}`);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-confirm-title"
    >
      <div
        className="relative z-[201] w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p id="payment-confirm-title" className="text-lg font-bold">
          Bixinta ma xaqiijisay?
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Merchant gaan &apos;USSD code&apos; ku bixi. Haddii aad lacagta bixisay, taabo &apos;Haa, waan bixiyay&apos;
          siyad u aragto dalabkaga halku marayo. Mahadsanid!
        </p>
        {orderIds.length > 1 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Lacagta hal mar ayaa loo bixiyaa labada dalab (miiska iyo qaadasho).
          </p>
        )}
        <p className="mt-2 font-mono text-xs text-muted-foreground">{ussdCode}</p>
        {!isOnline && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Offline mode — order will sync when you reconnect.
          </p>
        )}
        {brand ? (
          <OrderPrimaryButton
            type="button"
            size="lg"
            onClick={handlePaymentConfirmed}
            className="mt-6 w-full cursor-pointer"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Haa, waan bixiyay
          </OrderPrimaryButton>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={handlePaymentConfirmed}
            className="mt-6 w-full cursor-pointer border-0 hover:opacity-90"
            style={confirmStyle}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Haa, waan bixiyay
          </Button>
        )}
      </div>
    </div>,
    document.body
  );
}
