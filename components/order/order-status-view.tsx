"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Clock, PartyPopper, Phone, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

function deliveryCodeLabel(order: { id: string; order_number?: number | null }) {
  if (order.order_number != null) return `#${order.order_number}`;
  return `#${order.id.substring(0, 3).toUpperCase()}`;
}

function HorizontalStatusStepper({
  currentIndex,
  accent,
  customBrandingActive,
}: {
  currentIndex: number;
  accent: string;
  customBrandingActive: boolean;
}) {
  return (
    <div className="w-full shrink-0 overflow-hidden py-1">
      <div className="flex flex-row items-start gap-1 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2">
        {STATUS_STEPS.map((step, idx) => {
          const isPast = currentIndex >= 0 && idx < currentIndex;
          const isCurrent = currentIndex >= 0 && idx === currentIndex;
          const isFuture = currentIndex < 0 || idx > currentIndex;
          const connectorActive = currentIndex > idx;

          return (
            <div key={step.key} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-[3.25rem] flex-1 flex-col items-center gap-1 sm:min-w-0">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isFuture && "border-gray-200 bg-gray-50 text-gray-400",
                    isPast && "border-gray-300 bg-gray-100 text-gray-500"
                  )}
                  style={
                    isCurrent
                      ? {
                          ...customerPrimaryButtonStyleFromAccent(accent, customBrandingActive),
                          borderColor: accent,
                          boxShadow: `0 0 0 3px ${brandColorWithAlpha(accent, 0.22)}`,
                        }
                      : isPast
                        ? { borderColor: accent, color: accent, backgroundColor: brandColorWithAlpha(accent, 0.08) }
                        : undefined
                  }
                >
                  {isPast ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden="true" />
                  ) : isCurrent ? (
                    <Clock className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
                  ) : (
                    <span className="text-[10px] font-bold">{idx + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "max-w-[4.5rem] text-center text-[9px] font-semibold leading-tight sm:text-[10px]",
                    isCurrent ? "text-gray-900" : isPast ? "text-gray-500" : "text-gray-400"
                  )}
                  style={isCurrent ? customerAccentTextStyleFromAccent(accent) : undefined}
                >
                  {step.label}
                </span>
              </div>

              {idx < STATUS_STEPS.length - 1 && (
                <div
                  className="mt-4 h-0.5 min-w-[6px] flex-1 rounded-full sm:min-w-[10px]"
                  style={{
                    backgroundColor: connectorActive || isCurrent ? accent : "#E5E7EB",
                    opacity: connectorActive ? 0.85 : isCurrent ? 0.45 : 1,
                  }}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrderStatusView({
  orderId,
  restaurantName,
  takeawayHotline,
  newOrderHref,
  className,
}: {
  orderId: string;
  restaurantName: string;
  takeawayHotline?: string | null;
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
  const isTakeaway = order?.order_type === "takeaway";
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
        "flex h-full min-h-0 w-full max-w-lg flex-1 flex-col justify-center overflow-hidden px-1",
        className
      )}
      onPointerDown={() => unlockOrderSounds()}
    >
      <div className="shrink-0 space-y-1.5 text-center">
        <div
          className="mx-auto flex h-8 w-8 items-center justify-center rounded-full"
          style={{
            backgroundColor: brandColorWithAlpha(accent, 0.15),
            color: accent,
          }}
        >
          {isFinal ? (
            <Receipt className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
        </div>

        {order && !isTakeaway && (
          <div className="mx-auto inline-flex max-w-full items-center justify-center rounded-full bg-white px-3 py-0.5 text-sm font-bold tracking-wide text-gray-900 shadow-sm ring-1 ring-gray-100">
            <span className="truncate">{formatOrderLabel(order)}</span>
          </div>
        )}

        {order && isTakeaway && (
          <div
            className="mx-auto inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-bold shadow-sm ring-1 ring-black/5"
            style={{
              backgroundColor: brandColorWithAlpha(accent, customBrandingActive ? 0.16 : 0.12),
              color: accent,
              borderColor: accent,
            }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
              Delivery Code
            </span>
            <span className="text-base tracking-wide text-gray-900">{deliveryCodeLabel(order)}</span>
          </div>
        )}

        <h1 className="text-base font-bold leading-tight text-gray-900">
          {isFinal ? "Dalabkaagu waa la geeyay!" : "Dalabkaagu wuu socdaa!"}
        </h1>
        <p className="text-[11px] leading-snug text-gray-500">{restaurantName}</p>
      </div>

      {isTakeaway && takeawayHotline && (
        <a
          href={`tel:${takeawayHotline.replace(/\s+/g, "")}`}
          className="mt-2 flex shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-xs font-semibold transition-all duration-200 hover:opacity-90"
          style={{
            borderColor: brandColorWithAlpha(accent, 0.35),
            backgroundColor: brandColorWithAlpha(accent, customBrandingActive ? 0.12 : 0.08),
            color: accent,
          }}
        >
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            For takeaway tracking, call:{" "}
            <span className="font-bold text-gray-900">{takeawayHotline}</span>
          </span>
        </a>
      )}

      {!isFinal && (
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
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
        <div className="mt-1.5 flex justify-center">
          <Badge className="border-green-200 bg-green-100 px-2.5 py-0.5 text-[10px] font-semibold text-green-800 hover:bg-green-100">
            Dhammaystiran
          </Badge>
        </div>
      )}

      {receiptMessage && (
        <p
          className="mt-1.5 line-clamp-2 text-center text-xs font-semibold leading-snug"
          style={customerAccentTextStyleFromAccent(accent)}
        >
          <Receipt className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {receiptMessage}
        </p>
      )}

      {!receiptMessage && isReady && (
        <p className="mt-1 text-center text-xs font-semibold text-green-700">
          <PartyPopper className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          Your meal is ready!
        </p>
      )}

      {paymentMessage && (
        <p className="mt-1 line-clamp-2 text-center text-[11px] leading-snug text-gray-600">
          {paymentMessage}
        </p>
      )}

      {workflowMessage && (
        <p className="mt-1 line-clamp-2 text-center text-[10px] leading-snug text-gray-500">
          {workflowMessage}
        </p>
      )}

      <div className="mt-2 shrink-0">
        <HorizontalStatusStepper
          currentIndex={currentIndex}
          accent={accent}
          customBrandingActive={customBrandingActive}
        />
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
        <WaitingRunnerGame className="w-full" />
      </div>

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
