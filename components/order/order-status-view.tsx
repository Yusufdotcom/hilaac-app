"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  Hourglass,
  PartyPopper,
  Footprints,
  Phone,
  Plus,
  Receipt,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WaitingGame } from "@/components/order/WaitingGame";
import { LoyaltyStatusCard } from "@/components/order/loyalty-status-card";
import { useOrderStatusRealtime } from "@/lib/hooks/use-order-status-realtime";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import { customerStatusWorkflowMessage } from "@/lib/order/billing-model";
import { isAwaitingCashierConfirmation } from "@/lib/payments/constants";
import {
  brandColorWithAlpha,
  customerAccentTextStyleFromAccent,
  resolveCustomerAccent,
} from "@/lib/brand/restaurant-brand";
import {
  playCustomerReadyChime,
  unlockOrderSounds,
} from "@/lib/sounds/play-order-sound";
import { cn, formatOrderLabel } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

const STATUS_STEPS: {
  key: OrderStatus;
  label: string;
  icon: ReactNode;
}[] = [
  { key: "new", label: "Waka heyna", icon: <Hourglass className="h-4 w-4" strokeWidth={2.25} /> },
  { key: "preparing", label: "Wanu ku karineyna", icon: <ChefHat className="h-4 w-4" strokeWidth={2.25} /> },
  { key: "ready", label: "Diyaar", icon: <Bell className="h-4 w-4" strokeWidth={2.25} /> },
  {
    key: "delivered",
    label: "La geeyay",
    icon: <Footprints className="h-4 w-4" strokeWidth={2.25} />,
  },
];

function statusStepIndex(status: OrderStatus | undefined) {
  if (!status || status === "awaiting_payment") return -1;
  if (status === "completed") return STATUS_STEPS.length - 1;
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

function deliveryCodeLabel(order: { id: string; order_number?: number | null }) {
  if (order.order_number != null) return `#${order.order_number}`;
  return `#${order.id.substring(0, 3).toUpperCase()}`;
}

function PremiumStatusStepper({
  currentIndex,
  accent,
}: {
  currentIndex: number;
  accent: string;
}) {
  const progress =
    currentIndex < 0
      ? 0
      : Math.min(1, currentIndex / Math.max(1, STATUS_STEPS.length - 1));

  return (
    <div className="w-full shrink-0 px-1 py-2">
      <div className="relative mx-auto max-w-sm pt-1">
        {/* Track */}
        <div
          className="absolute left-[12%] right-[12%] top-[22px] h-1.5 overflow-hidden rounded-full bg-gray-100"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${progress * 100}%`,
              background: `linear-gradient(90deg, ${brandColorWithAlpha(accent, 0.55)}, ${accent})`,
              boxShadow: `0 0 12px ${brandColorWithAlpha(accent, 0.45)}`,
            }}
          />
        </div>

        <div className="relative flex justify-between">
          {STATUS_STEPS.map((step, idx) => {
            const isPast = currentIndex >= 0 && idx < currentIndex;
            const isCurrent = currentIndex >= 0 && idx === currentIndex;
            const isFuture = currentIndex < 0 || idx > currentIndex;

            return (
              <div key={step.key} className="flex w-[22%] flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center rounded-2xl border-2 bg-white transition-all duration-500",
                    isFuture && "border-gray-200 text-gray-400",
                    isPast && "text-white",
                    isCurrent && "text-white"
                  )}
                  style={
                    isCurrent
                      ? {
                          backgroundColor: accent,
                          borderColor: accent,
                          boxShadow: `0 0 0 4px ${brandColorWithAlpha(accent, 0.22)}, 0 8px 20px ${brandColorWithAlpha(accent, 0.35)}`,
                          animation: "order-status-pulse 1.8s ease-in-out infinite",
                        }
                      : isPast
                        ? {
                            backgroundColor: accent,
                            borderColor: accent,
                            opacity: 0.92,
                          }
                        : undefined
                  }
                >
                  {isPast ? (
                    <Check className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true">{step.icon}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "max-w-[4.75rem] text-center text-[10px] font-semibold leading-tight transition-colors duration-300",
                    isCurrent ? "text-[#0F172A]" : isPast ? "text-gray-600" : "text-gray-400"
                  )}
                  style={isCurrent ? customerAccentTextStyleFromAccent(accent) : undefined}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes order-status-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}

function DeliveredCelebration({ accent }: { accent: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-2 py-4 text-center animate-in fade-in zoom-in-95 duration-500">
      <div
        className="relative flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: `linear-gradient(145deg, ${brandColorWithAlpha(accent, 0.22)}, ${brandColorWithAlpha(accent, 0.08)})`,
          boxShadow: `0 12px 36px ${brandColorWithAlpha(accent, 0.28)}`,
          animation: "order-status-celebrate 1.2s ease-out both",
        }}
      >
        <CheckCircle2
          className="h-11 w-11"
          style={{ color: accent }}
          strokeWidth={2}
          aria-hidden="true"
        />
        <PartyPopper
          className="absolute -right-1 -top-1 h-5 w-5 text-[#0F172A]"
          aria-hidden="true"
        />
      </div>
      <div>
        <p className="mt-1 text-xs text-gray-500">
          Receipt ka waxa ku keenaya waiter ka. Mahadsanid!
        </p>
      </div>
      <style>{`
        @keyframes order-status-celebrate {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
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
  const loadState = useOrderStatusRealtime(orderId);
  const order = loadState.status === "ready" ? loadState.order : null;
  const loyalty = loadState.status === "ready" ? loadState.loyalty : null;
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

  const paymentMessage = isFinal
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
    isFinal || paymentMessage ? null : order ? customerStatusWorkflowMessage(order) : null;

  if (loadState.status === "loading") {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-2 px-4 text-center",
          className
        )}
      >
        <Clock className="h-6 w-6 animate-pulse text-gray-400" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-900">Dalabkaga waa la diyaarinayaa  ...</p>
        <p className="text-xs text-gray-500">Fadlan sug…</p>
      </div>
    );
  }

  if (loadState.status === "error" || !order) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 px-4 text-center",
          className
        )}
      >
        <p className="text-sm font-bold text-gray-900">
          {loadState.status === "error" ? loadState.error : "Could not load order status."}
        </p>
        <p className="max-w-xs text-xs text-gray-500">
          Dalabkaagu wuu jiraa, laakiin lama akhriyi karin. Isku day mar kale.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
          <Link href={newOrderHref}>Dalab kale ma rabtaa?</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 flex-col justify-center overflow-hidden px-1",
        "animate-in fade-in slide-in-from-bottom-3 duration-500",
        className
      )}
      onPointerDown={() => unlockOrderSounds()}
    >
      <div className="shrink-0 space-y-2 text-center animate-in fade-in duration-500">
        <div
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: brandColorWithAlpha(accent, 0.15),
            color: accent,
          }}
        >
          {isFinal ? (
            <Receipt className="h-4 w-4" aria-hidden="true" />
          ) : (
            <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
          )}
        </div>

        {!isTakeaway && (
          <div className="mx-auto inline-flex max-w-full items-center justify-center rounded-full bg-white px-3 py-0.5 text-sm font-bold tracking-wide text-[#0F172A] shadow-sm ring-1 ring-gray-100">
            <span className="truncate">{formatOrderLabel(order)}</span>
          </div>
        )}

        {isTakeaway && (
          <div
            className="mx-auto inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-bold shadow-sm ring-1 ring-black/5"
            style={{
              backgroundColor: brandColorWithAlpha(accent, customBrandingActive ? 0.16 : 0.12),
              color: accent,
            }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
              Delivery Code
            </span>
            <span className="text-base tracking-wide text-[#0F172A]">
              {deliveryCodeLabel(order)}
            </span>
          </div>
        )}

        <h1 className="text-lg font-bold leading-tight tracking-tight text-[#0F172A]">
          {isFinal ? "Dalabkaagu wuu dhamaaday!" : "Dalabkaagu wuu socdaa!"}
        </h1>
        <p className="text-[11px] leading-snug text-gray-500">{restaurantName}</p>
      </div>

      {isTakeaway && takeawayHotline && !isFinal && (
        <a
          href={`tel:${takeawayHotline.replace(/\s+/g, "")}`}
          className="mt-2 flex shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-xs font-semibold transition-all duration-200 hover:opacity-90 animate-in fade-in duration-500"
          style={{
            borderColor: brandColorWithAlpha(accent, 0.35),
            backgroundColor: brandColorWithAlpha(accent, customBrandingActive ? 0.12 : 0.08),
            color: accent,
          }}
        >
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            For takeaway tracking, call:{" "}
            <span className="font-bold text-[#0F172A]">{takeawayHotline}</span>
          </span>
        </a>
      )}

      {!isFinal && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {awaitingCashier && (
            <Badge className="border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-50">
              Cashierka ayaa xaqiijiniya
            </Badge>
          )}
          {order.payment_status === "paid" && (
            <Badge className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800 hover:bg-emerald-50">
              Lacagta waa la xaqiijiyay
            </Badge>
          )}
        </div>
      )}

      {!isFinal && isReady && (
        <p className="mt-1.5 text-center text-xs font-semibold text-emerald-700">
          <PartyPopper className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          Dalabkagu waa diyar asago kulul!
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

      <div className="mt-3 shrink-0">
        {isFinal ? (
          <DeliveredCelebration accent={accent} />
        ) : (
          <PremiumStatusStepper currentIndex={currentIndex} accent={accent} />
        )}
      </div>

      {loyalty?.enabled && <LoyaltyStatusCard loyalty={loyalty} accent={accent} />}

      {!isFinal && (
        <div className="mt-3 shrink-0">
          <WaitingGame accent={accent} />
        </div>
      )}

      <div className="mt-auto pt-3">
        <Link
          href={newOrderHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all duration-300",
            "active:scale-[0.98] hover:opacity-95"
          )}
          style={{
            background: `linear-gradient(135deg, ${brandColorWithAlpha(accent, 0.16)}, ${brandColorWithAlpha(accent, 0.06)})`,
            color: "#0F172A",
            border: `1px solid ${brandColorWithAlpha(accent, 0.28)}`,
            boxShadow: `0 6px 20px ${brandColorWithAlpha(accent, 0.14)}`,
          }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: accent }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </span>
          Dalab kale ma rabtaa?
        </Link>
      </div>
    </div>
  );
}
