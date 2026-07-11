"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Crown, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PLANS } from "@/lib/constants";
import { formatDate, daysUntil } from "@/lib/utils";
import type { Restaurant } from "@/types/database";

const HILAAC_PAYMENT_CODES = {
  evc: process.env.NEXT_PUBLIC_HILAAC_EVC_USSD ?? "*712*9*79#",
  edahab: process.env.NEXT_PUBLIC_HILAAC_EDAHAB_USSD ?? "*888*9*79#",
};

export function BillingView({ restaurant }: { restaurant: Restaurant }) {
  const router = useRouter();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [method, setMethod] = useState<"evc" | "edahab" | null>(null);
  const [confirming, setConfirming] = useState(false);

  const daysLeft = daysUntil(restaurant.subscription_end_date);
  const isPro = restaurant.subscription_tier === "pro";
  const isExpired = restaurant.subscription_status === "expired" || daysLeft < 0;

  function dial(method: "evc" | "edahab") {
    setMethod(method);
    window.location.href = `tel:${encodeURIComponent(HILAAC_PAYMENT_CODES[method])}`;
  }

  async function handleConfirmPayment() {
    setConfirming(true);
    try {
      const res = await fetch("/api/admin/subscriptions/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurant.id, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not confirm payment");
      toast.success("Upgraded to Pro! Enjoy AI menus and API payments.");
      setUpgradeOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              Current Plan
              {isPro && <Crown className="h-5 w-5 text-amber-500" />}
            </CardTitle>
            <CardDescription>Your subscription status and renewal date.</CardDescription>
          </div>
          <Badge variant={isExpired ? "destructive" : isPro ? "default" : "secondary"} className="text-sm capitalize">
            {restaurant.subscription_tier}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {isExpired ? "Your subscription has expired." : `Renews / expires on ${formatDate(restaurant.subscription_end_date)}`}
          </p>
          {!isExpired && (
            <p className="text-sm text-muted-foreground">
              {daysLeft} day{daysLeft === 1 ? "" : "s"} remaining
            </p>
          )}
          {!isPro && (
            <Button className="mt-4" onClick={() => setUpgradeOpen(true)}>
              <Crown className="h-4 w-4" /> Upgrade to Pro
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        {Object.entries(PLANS).map(([key, plan]) => (
          <Card key={key} className={restaurant.subscription_tier === key || (key === "pro" && isPro) ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <div className="text-3xl font-bold">{plan.priceLabel}</div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to Pro — $79/mo</DialogTitle>
            <DialogDescription>Pay via mobile money, then confirm below to unlock Pro instantly.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="success" size="lg" onClick={() => dial("evc")}>
              <Smartphone className="h-4 w-4" /> Ku bixi EVC
            </Button>
            <Button variant="warning" size="lg" onClick={() => dial("edahab")}>
              <Smartphone className="h-4 w-4" /> Ku bixi eDahab
            </Button>
          </div>

          {method && (
            <div className="rounded-lg border bg-muted/50 p-4 text-sm">
              <p>
                Dialing <span className="font-mono font-semibold">{HILAAC_PAYMENT_CODES[method]}</span> on your phone. Once
                you&apos;ve completed the payment, tap the button below.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleConfirmPayment} disabled={!method || confirming} className="w-full">
              {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
              Haa, waan bixiyay (Yes, I&apos;ve paid)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
