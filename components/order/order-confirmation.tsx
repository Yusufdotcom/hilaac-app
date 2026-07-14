"use client";

import Link from "next/link";
import { CheckCircle2, ChefHat, Clock, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { useOrderStatusRealtime } from "@/lib/hooks/use-order-status-realtime";
import type { OrderStatus } from "@/types/database";
import { cn } from "@/lib/utils";

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

function OrderStatusBadge({ status }: { status: OrderStatus | undefined }) {
  if (!status) return null;

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

export function OrderConfirmation({
  orderId,
  restaurant,
  onNewOrder,
  newOrderHref,
}: {
  orderId: string;
  restaurant: { name: string };
  onNewOrder?: () => void;
  newOrderHref?: string;
}) {
  const order = useOrderStatusRealtime(orderId);

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === order?.status);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-hilaac-gold/20 text-hilaac-gold">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">Dalabkaagu wuu socdaa!</h1>
      <p className="mt-1 text-muted-foreground">{restaurant.name} ayaa diyaarinaya dalabkaaga.</p>

      <div className="mt-4">
        <OrderStatusBadge status={order?.status} />
      </div>

      <div className="mt-8 w-full max-w-sm space-y-3">
        {STATUS_STEPS.map((step, idx) => (
          <div
            key={step.key}
            className={`flex items-center gap-3 rounded-lg border p-3 text-left ${
              idx <= currentIndex ? "border-primary bg-primary/5" : "opacity-50"
            }`}
          >
            {idx < currentIndex ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : idx === currentIndex ? (
              <ChefHat className="h-5 w-5 text-primary" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-medium">{step.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">Payment:</span>
        {order?.payment_status === "paid" ? (
          <Badge variant="success">✅ Paid</Badge>
        ) : order?.payment_status === "failed" ? (
          <Badge variant="destructive">Failed</Badge>
        ) : (
          <Badge variant="warning">Pending</Badge>
        )}
      </div>

      {order?.status === "completed" && (
        <div className="mt-8 flex items-center gap-2 text-hilaac-gold">
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

      <PoweredByHilaac className="mt-auto pt-10" />
    </div>
  );
}
