"use client";

import Link from "next/link";
import { CheckCircle2, ChefHat, Clock, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { OrderCustomerPhone } from "@/components/staff/order-customer-phone";
import { useOrderStatusRealtime } from "@/lib/hooks/use-order-status-realtime";
import { customerStatusWorkflowMessage } from "@/lib/order/billing-model";
import { PENDING_CASHIER_CONFIRMATION } from "@/lib/payments/constants";
import type { OrderStatus, PaymentStatus } from "@/types/database";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import {
  brandColorWithAlpha,
  customerAccentTextStyleFromAccent,
  customerPrimaryButtonStyleFromAccent,
  resolveCustomerAccent,
} from "@/lib/brand/restaurant-brand";
import { cn, formatOrderLabel } from "@/lib/utils";

const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: "new", label: "La helay" },
  { key: "preparing", label: "Karinta" },
  { key: "ready", label: "Diyaar" },
  { key: "delivered", label: "La geeyay" },
  { key: "completed", label: "Dhammaystiran" },
];

const STATUS_BADGE: Record<
  "new" | "preparing" | "ready" | "delivered",
  { label: string; className: string }
> = {
  new: { label: "New", className: "border-gray-200 bg-gray-100 text-gray-700" },
  preparing: { label: "Preparing", className: "border-yellow-200 bg-yellow-100 text-yellow-800" },
  ready: { label: "Ready", className: "border-green-200 bg-green-100 text-green-800" },
  delivered: { label: "Delivered", className: "border-blue-200 bg-blue-100 text-blue-800" },
};

function PaymentStatusBadge({
  paymentStatus,
  customerConfirmedAt,
  compact,
}: {
  paymentStatus?: PaymentStatus;
  customerConfirmedAt?: string | null;
  compact?: boolean;
}) {
  if (paymentStatus === "paid") {
    return (
      <Badge variant="success" className={cn(compact ? "text-xs leading-snug" : "text-sm")}>
        ✅ Payment verified by cashier
      </Badge>
    );
  }

  if (paymentStatus === "failed") {
    return (
      <Badge variant="destructive" className={cn(compact ? "text-xs" : "text-sm")}>
        Failed
      </Badge>
    );
  }

  if (paymentStatus === PENDING_CASHIER_CONFIRMATION || customerConfirmedAt) {
    return (
      <Badge
        variant="warning"
        className={cn(
          "max-w-[260px] whitespace-normal text-center leading-snug",
          compact ? "text-xs" : "text-sm"
        )}
      >
        ⏳ Awaiting cashier verification
      </Badge>
    );
  }

  return (
    <Badge variant="warning" className={cn(compact ? "text-xs" : "text-sm")}>
      Pending
    </Badge>
  );
}

function OrderStatusBadge({ status }: { status: OrderStatus | undefined }) {
  if (!status) return null;

  if (status === "awaiting_payment") {
    return (
      <Badge variant="outline" className="border-orange-200 bg-orange-50 text-sm text-orange-800">
        Awaiting payment
      </Badge>
    );
  }

  const badgeKey =
    status === "completed" ? "delivered" : status in STATUS_BADGE ? (status as keyof typeof STATUS_BADGE) : null;

  if (!badgeKey) return null;

  const { label, className } = STATUS_BADGE[badgeKey];

  return (
    <Badge variant="outline" className={cn("text-sm", className)}>
      {label}
    </Badge>
  );
}

function WorkflowMessage({
  order,
  compact,
}: {
  order: NonNullable<ReturnType<typeof useOrderStatusRealtime>>;
  compact?: boolean;
}) {
  const message = customerStatusWorkflowMessage(order);
  if (!message) return null;

  return (
    <p
      className={cn(
        "rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-center text-[#64748B]",
        compact ? "mt-2 text-xs leading-snug" : "mt-4 text-sm"
      )}
    >
      {message}
    </p>
  );
}

function CompactStatusSteps({
  currentIndex,
  stepStyle,
}: {
  currentIndex: number;
  stepStyle: React.CSSProperties;
}) {
  return (
    <div className="flex w-full max-w-xs items-start justify-between gap-1">
      {STATUS_STEPS.map((step, idx) => {
        const active = idx <= currentIndex;
        const current = idx === currentIndex;

        return (
          <div key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                !active && "bg-muted text-muted-foreground"
              )}
              style={active ? stepStyle : undefined}
            >
              {idx < currentIndex ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : current ? (
                <ChefHat className="h-3.5 w-3.5" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
            </div>
            <span
              className={cn(
                "mt-1 w-full truncate text-center text-[10px] leading-tight",
                current ? "font-semibold text-foreground" : active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function OrderConfirmation({
  orderId,
  restaurant,
  onNewOrder,
  newOrderHref,
  openNewOrderInNewTab = false,
  compact = false,
  className,
  showFooter = true,
}: {
  orderId: string;
  restaurant: { name: string };
  onNewOrder?: () => void;
  newOrderHref?: string;
  openNewOrderInNewTab?: boolean;
  compact?: boolean;
  className?: string;
  showFooter?: boolean;
}) {
  const order = useOrderStatusRealtime(orderId);
  const brand = useOrderBrandOptional();
  const accent = brand?.accent ?? resolveCustomerAccent(brand?.branding ?? {});
  const customBrandingActive = brand?.customBrandingActive ?? false;
  const accentIconStyle = {
    backgroundColor: brandColorWithAlpha(accent, 0.2),
    color: accent,
  };
  const accentTextStyle = customerAccentTextStyleFromAccent(accent);
  const activeStepStyle = customerPrimaryButtonStyleFromAccent(accent, customBrandingActive);

  const currentIndex =
    order?.status === "awaiting_payment"
      ? -1
      : STATUS_STEPS.findIndex((s) => s.key === order?.status);

  if (compact) {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col items-center text-center", className)}>
        <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center px-1">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full" style={accentIconStyle}>
            <CheckCircle2 className="h-6 w-6" />
          </div>

          {order && (
            <div className="mb-2 rounded-full bg-gray-100 px-4 py-1.5 text-base font-semibold tracking-wide text-[#0F172A]">
              {formatOrderLabel(order)}
            </div>
          )}

          <h1 className="text-lg font-bold leading-tight">Dalabkaagu wuu socdaa!</h1>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {restaurant.name} ayaa diyaarinaya dalabkaaga.
          </p>

          <div className="mt-2">
            <OrderStatusBadge status={order?.status} />
          </div>

          {order && <WorkflowMessage order={order} compact />}

          <div className="mt-4 w-full">
            <CompactStatusSteps currentIndex={currentIndex} stepStyle={activeStepStyle} />
          </div>

          <div className="mt-3 flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">Payment:</span>
            <PaymentStatusBadge
              paymentStatus={order?.payment_status}
              customerConfirmedAt={order?.customer_confirmed_at}
              compact
            />
          </div>

          <OrderCustomerPhone phone={order?.customer_phone} variant="badge" className="mt-2" />

          {order?.status === "completed" && (
            <div className="mt-2 flex items-center gap-1.5 text-sm" style={accentTextStyle}>
              <PartyPopper className="h-4 w-4" /> Mahadsanid!
            </div>
          )}

          {newOrderHref ? (
            <Button variant="outline" size="sm" className="mt-3 h-9" asChild>
              <Link
                href={newOrderHref}
                {...(openNewOrderInNewTab
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                Samee dalab cusub
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="mt-3 h-9" onClick={onNewOrder}>
              Samee dalab cusub
            </Button>
          )}
        </div>

        {showFooter && <PoweredByHilaac className="mt-auto shrink-0 pb-2" />}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={accentIconStyle}>
        <CheckCircle2 className="h-8 w-8" />
      </div>
      {order && (
        <div className="mb-4 rounded-full bg-gray-100 px-5 py-2 text-lg font-semibold tracking-wide text-[#0F172A]">
          {formatOrderLabel(order)}
        </div>
      )}

      <h1 className="text-2xl font-bold">Dalabkaagu wuu socdaa!</h1>
      <p className="mt-1 text-muted-foreground">{restaurant.name} ayaa diyaarinaya dalabkaaga.</p>

      <div className="mt-4">
        <OrderStatusBadge status={order?.status} />
      </div>

      {order && <WorkflowMessage order={order} />}

      <div className="mt-8 w-full max-w-sm space-y-3">
        {STATUS_STEPS.map((step, idx) => (
          <div
            key={step.key}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left",
              idx > currentIndex && "opacity-50"
            )}
            style={
              idx <= currentIndex
                ? {
                    borderColor: accent,
                    backgroundColor: brandColorWithAlpha(accent, customBrandingActive ? 0.15 : 0.08),
                  }
                : undefined
            }
          >
            {idx < currentIndex ? (
              <CheckCircle2 className="h-5 w-5" style={{ color: accent }} />
            ) : idx === currentIndex ? (
              <ChefHat className="h-5 w-5" style={{ color: accent }} />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-medium">{step.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">Payment:</span>
        <PaymentStatusBadge
          paymentStatus={order?.payment_status}
          customerConfirmedAt={order?.customer_confirmed_at}
        />
      </div>

      <OrderCustomerPhone phone={order?.customer_phone} variant="badge" className="mt-3" />

      {order?.status === "completed" && (
        <div className="mt-8 flex items-center gap-2" style={accentTextStyle}>
          <PartyPopper className="h-5 w-5" /> Mahadsanid!
        </div>
      )}

      {newOrderHref ? (
        <Button variant="outline" className="mt-10" asChild>
          <Link href={newOrderHref}>Samee dalab cusub</Link>
        </Button>
      ) : (
        <Button variant="outline" className="mt-10" onClick={onNewOrder}>
          Samee dalab cusub
        </Button>
      )}

      {showFooter && <PoweredByHilaac className="mt-auto pt-10" />}
    </div>
  );
}
