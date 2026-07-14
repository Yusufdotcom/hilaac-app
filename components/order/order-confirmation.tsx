"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChefHat, Clock, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";

interface TrackedOrder {
  id: string;
  status: "new" | "preparing" | "ready" | "delivered" | "completed";
  payment_status: "pending" | "paid" | "failed";
}

const STATUS_STEPS: { key: TrackedOrder["status"]; label: string }[] = [
  { key: "new", label: "La helay" },
  { key: "preparing", label: "Karinta" },
  { key: "ready", label: "Diyaar" },
  { key: "delivered", label: "La geeyay" },
  { key: "completed", label: "Dhammaystiran" },
];

export function OrderConfirmation({
  orderId,
  restaurant,
  onNewOrder,
}: {
  orderId: string;
  restaurant: { name: string };
  onNewOrder: () => void;
}) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}/track`, { cache: "no-store" });
        const data = await res.json();
        if (active && res.ok) setOrder(data.order);
      } catch {
        // ignore transient network errors, next poll will retry
      }
    }

    poll();
    const interval = setInterval(poll, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orderId]);

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === order?.status);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-hilaac-gold/20 text-hilaac-gold">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">Dalabkaagu wuu socdaa!</h1>
      <p className="mt-1 text-muted-foreground">{restaurant.name} ayaa diyaarinaya dalabkaaga.</p>

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

      <div className="mt-6 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Lacag bixinta:</span>
        <Badge variant={order?.payment_status === "paid" ? "success" : order?.payment_status === "failed" ? "destructive" : "warning"} className="capitalize">
          {order?.payment_status ?? "pending"}
        </Badge>
      </div>

      {order?.status === "completed" && (
        <div className="mt-8 flex items-center gap-2 text-hilaac-gold">
          <PartyPopper className="h-5 w-5" /> Mahadsanid!
        </div>
      )}

      <Button variant="outline" className="mt-10" onClick={onNewOrder}>
        Samee dalab cusub
      </Button>

      <PoweredByHilaac className="mt-auto pt-10" />
    </div>
  );
}
