"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Clock, PartyPopper, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderCustomerPhone } from "@/components/staff/order-customer-phone";
import { WaitingRunnerGame } from "@/components/order/waiting-runner-game";
import { useOrderStatusRealtime } from "@/lib/hooks/use-order-status-realtime";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import { customerStatusWorkflowMessage } from "@/lib/order/billing-model";
import { isAwaitingCashierConfirmation } from "@/lib/payments/constants";
import {
  brandColorWithAlpha,
  customerAccentTextStyleFromAccent,
  customerPrimaryButtonStyleFromAccent,
  resolveCustomerAccent,
} from "@/lib/brand/restaurant-brand";
import {
  playCustomerReadyChime,
  unlockOrderSounds,
} from "@/lib/sounds/play-order-sound";
import { cn, formatOrderLabel } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: "new", label: "La helay" },
  { key: "preparing", label: "Karinta" },
  { key: "ready", label: "Diyaar" },
  { key: "delivered", label: "La geeyay" },
  { key: "completed", label: "Dhammaystiran" },
];

function statusStepIndex(status: OrderStatus | undefined) {
  if (!status || status === "awaiting_payment") return -1;
  if (status === "completed") {
    return STATUS_STEPS.findIndex((s) => s.key === "completed");
  }
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

function StatusTimeline({
  currentIndex,
  accent,
  customBrandingActive,
}: {
  currentIndex: number;
  accent: string;
  customBrandingActive: boolean;
}) {
  return (
    <div className="relative w-full space-y-1.5">
      {STATUS_STEPS.map((step, idx) => {
        const isPast = currentIndex >= 0 && idx < currentIndex;
        const isCurrent = currentIndex >= 0 && idx === currentIndex;
        const isFuture = currentIndex < 0 || idx > currentIndex;

        return (
          <div key={step.key} className="relative flex items-stretch gap-2">
            {idx < STATUS_STEPS.length - 1 && (
              <div
                className="absolute left-[17px] top-[34px] h-[calc(100%+2px)] w-0.5 -translate-x-1/2"
                style={{
                  backgroundColor: isPast || isCurrent ? accent : "#E5E7EB",
                  opacity: isFuture ? 0.35 : isPast ? 0.45 : 1,
                }}
                aria-hidden="true"
              />
            )}

            <article
              className={cn(
                "relative z-[1] flex flex-1 items-center gap-2 rounded-xl border px-2 py-1.5 transition-all duration-300",
                isFuture && "border-gray-100 bg-gray-50/80 opacity-50",
                isPast && "border-gray-200 bg-gray-50/90 opacity-70",
                isCurrent && "animate-[status-pulse_2s_ease-in-out_infinite]"
              )}
              style={
                isCurrent
                  ? {
                      borderColor: accent,
                      backgroundColor: brandColorWithAlpha(accent, customBrandingActive ? 0.16 : 0.12),
                      boxShadow: `0 4px 18px ${brandColorWithAlpha(accent, 0.28)}`,
                    }
                  : undefined
              }
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                  isFuture && "bg-gray-100 text-gray-400",
                  isPast && "bg-gray-200 text-gray-500"
                )}
                style={
                  isCurrent
                    ? customerPrimaryButtonStyleFromAccent(accent, customBrandingActive)
                    : undefined
                }
              >
                {isPast ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                ) : isCurrent ? (
                  <Clock className="h-4 w-4 animate-pulse" aria-hidden="true" />
                ) : (
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </div>

              <span
                className={cn(
                  "text-xs font-semibold leading-tight",
                  isCurrent ? "text-gray-900" : isPast ? "text-gray-500" : "text-gray-400"
                )}
                style={isCurrent ? customerAccentTextStyleFromAccent(accent) : undefined}
              >
                {step.label}
              </span>
            </article>
          </div>
        );
      })}
    </div>
  );
}

export function OrderStatusView({
  orderId,
  restaurantName,
  newOrderHref,
  className,
}: {
  orderId: string;
  restaurantName: string;
  newOrderHref: string;
  className?: string;
}) {
  const order = useOrderStatusRealtime(orderId);
  const brand = useOrderBrandOptional();
  const accent = brand?.accent ?? resolveCustomerAccent(brand?.branding ?? {});
  const customBrandingActive = brand?.customBrandingActive ?? false;
  const prevStatusRef = useRef<string | null>(null);
  const chimePlayedRef = useRef(false);

  const currentIndex = statusStepIndex(order?.status);

  const isCompleted = order?.status === "completed";
  const isDelivered = order?.status === "delivered";
  const isFinal = isDelivered || isCompleted;
  const isReady = order?.status === "ready";
  const awaitingCashier = order ? isAwaitingCashierConfirmation(order) : false;

  const receiptMessage = isFinal
    ? "Receipt ka waxa ku keenaya waiter ka. Mahadsanid!"
    : null;

  const paymentMessage =
    receiptMessage
      ? null
      : order?.payment_status === "pending"
        ? "Payment pending. Please show your payment confirmation to the cashier."
        : order?.payment_status === "paid"
          ? "Your meal is being prepared. Ask the cashier for your bill when you are ready to pay."
          : null;

  useEffect(() => {
    const handler = () => unlockOrderSounds();
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  useEffect(() => {
    if (!order) return;

    const prev = prevStatusRef.current;
    if (prev !== null && prev !== "ready" && order.status === "ready" && !chimePlayedRef.current) {
      chimePlayedRef.current = true;
      playCustomerReadyChime();
    }

    prevStatusRef.current = order.status;
  }, [order?.status, order]);

  const workflowMessage =
    receiptMessage || paymentMessage ? null : order ? customerStatusWorkflowMessage(order) : null;

  return (
    <div
      className={cn(
        "flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center overflow-hidden px-1",
        className
      )}
      onPointerDown={() => unlockOrderSounds()}
    >
      <div className="shrink-0 text-center">
        <div
          className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            backgroundColor: brandColorWithAlpha(accent, 0.15),
            color: accent,
          }}
        >
          {isFinal ? (
            <Receipt className="h-5 w-5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        {order && (
          <div className="mx-auto mb-1 inline-flex max-w-full items-center justify-center rounded-full bg-white px-3 py-0.5 text-sm font-bold tracking-wide text-gray-900 shadow-sm ring-1 ring-gray-100">
            <span className="truncate">{formatOrderLabel(order)}</span>
          </div>
        )}

        <h1 className="text-base font-bold leading-tight text-gray-900">
          {isFinal ? "Dalabkaagu waa la geeyay!" : "Dalabkaagu wuu socdaa!"}
        </h1>
        <p className="text-[11px] leading-snug text-gray-500">{restaurantName}</p>
      </div>

      {!isFinal && (
        <div className="my-1.5 flex flex-wrap items-center justify-center gap-1.5">
          {awaitingCashier && (
            <Badge className="border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-50">
              Waiting for cashier confirmation
            </Badge>
          )}
          {order?.payment_status === "paid" && (
            <Badge className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800 hover:bg-emerald-50">
              Lacagta waa la xaqiijiyay
            </Badge>
          )}
        </div>
      )}

      {isCompleted && (
        <div className="my-1.5 flex justify-center">
          <Badge className="border-green-200 bg-green-100 px-2.5 py-0.5 text-[10px] font-semibold text-green-800 hover:bg-green-100">
            Dhammaystiran
          </Badge>
        </div>
      )}

      {receiptMessage && (
        <p
          className="mb-1.5 text-center text-xs font-semibold leading-snug"
          style={customerAccentTextStyleFromAccent(accent)}
        >
          <Receipt className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {receiptMessage}
        </p>
      )}

      {!receiptMessage && (isReady || isFinal) && (
        <p className="mb-1 text-center text-xs font-semibold text-green-700">
          <PartyPopper className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          Your meal is ready!
        </p>
      )}

      {paymentMessage && (
        <p className="mb-1.5 line-clamp-2 text-center text-[11px] leading-snug text-gray-600">
          {paymentMessage}
        </p>
      )}

      {workflowMessage && (
        <p className="mb-1.5 line-clamp-2 text-center text-[10px] leading-snug text-gray-500">
          {workflowMessage}
        </p>
      )}

      <div className="min-h-0 shrink overflow-y-auto py-0.5">
        <StatusTimeline
          currentIndex={currentIndex}
          accent={accent}
          customBrandingActive={customBrandingActive}
        />
      </div>

      <OrderCustomerPhone phone={order?.customer_phone} variant="badge" className="mt-1 shrink-0" />

      <WaitingRunnerGame className="mt-1.5 w-full shrink-0" />

      <Button
        variant="outline"
        size="sm"
        className="mt-2 h-9 w-full shrink-0 rounded-xl border-gray-200 bg-white text-sm font-semibold shadow-sm"
        asChild
      >
        <Link href={newOrderHref} target="_blank" rel="noopener noreferrer">
          Samee dalab kale
        </Link>
      </Button>
    </div>
  );
}
