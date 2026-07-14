"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function PaymentConfirmationModal({
  open,
  orderId,
  slug,
  ussdCode,
  onClose,
}: {
  open: boolean;
  orderId: string;
  slug: string;
  ussdCode: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => setMounted(true), []);

  async function handlePaymentConfirmed() {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("id", orderId);

      if (error) {
        const res = await fetch(`/api/orders/${orderId}/confirm-payment`, { method: "POST" });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error ?? "Lacag bixinta lama xaqiijin karin");
          return;
        }
      }

      toast.success("Lacag bixinta waa la xaqiijiyay! Dalabkaaga waa la diyaarinayaa.");
      onClose();
      router.push(`/order/${slug}/status?orderId=${orderId}`);
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
        <p className="mt-2 font-mono text-xs text-muted-foreground">{ussdCode}</p>
        <Button
          type="button"
          size="lg"
          onClick={handlePaymentConfirmed}
          className="mt-6 w-full cursor-pointer hover:opacity-90"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Haa, waan bixiyay
        </Button>
      </div>
    </div>,
    document.body
  );
}
