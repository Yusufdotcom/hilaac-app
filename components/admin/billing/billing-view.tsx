"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, Crown, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { adminBrandBorderClass, adminBrandTextClass } from "@/lib/brand/admin-tokens";
import { PLANS } from "@/lib/constants";
import { cn, formatDate, daysUntil, formatCurrency } from "@/lib/utils";
import type { Restaurant } from "@/types/database";

type PayIntent = "renew" | "upgrade_pro";

type UssdPayload = {
  tier: "starter" | "pro";
  amount: number;
  priceLabel: string;
  planName: string;
  dial: { evc: string; edahab: string };
};

export function BillingView({ restaurant }: { restaurant: Restaurant }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payOpen, setPayOpen] = useState(false);
  const [intent, setIntent] = useState<PayIntent>("renew");
  const [ussd, setUssd] = useState<UssdPayload | null>(null);
  const [loadingUssd, setLoadingUssd] = useState(false);
  const [method, setMethod] = useState<"evc" | "edahab" | null>(null);
  const [txRef, setTxRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingRenewalId, setPendingRenewalId] = useState<string | null>(null);

  const daysLeft = daysUntil(restaurant.subscription_end_date);
  const isPro = restaurant.subscription_tier === "pro";
  const isExpired = restaurant.subscription_status === "expired" || daysLeft < 0;
  const renewTier = isPro ? "pro" : "starter";
  const renewAmount = PLANS[renewTier].price;

  useEffect(() => {
    if (searchParams.get("renew") === "1") {
      void openPay("renew");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from query
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/subscriptions/renewals", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const pending = (data.renewals ?? []).find(
          (r: { status: string }) => r.status === "pending_confirmation"
        );
        if (pending) setPendingRenewalId(pending.id);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function openPay(nextIntent: PayIntent) {
    setIntent(nextIntent);
    setMethod(null);
    setTxRef("");
    setUssd(null);
    setPayOpen(true);
    setLoadingUssd(true);
    try {
      const res = await fetch(
        `/api/admin/subscriptions/ussd?intent=${nextIntent}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load payment codes");
      setUssd(data as UssdPayload);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load payment codes");
      setPayOpen(false);
    } finally {
      setLoadingUssd(false);
    }
  }

  function dial(next: "evc" | "edahab") {
    if (!ussd) return;
    setMethod(next);
    window.location.href = `tel:${encodeURIComponent(ussd.dial[next])}`;
  }

  async function handleSubmitRenewal() {
    if (!method || !ussd) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/subscriptions/renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          method,
          intent,
          txRef: txRef.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit renewal");
      setPendingRenewalId(data.renewal?.id ?? "pending");
      toast.success("Payment submitted — Hilaac will confirm shortly.");
      setPayOpen(false);
      setTxRef("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              Current Plan
              {isPro && <Crown className={cn("h-5 w-5", adminBrandTextClass)} />}
            </CardTitle>
            <CardDescription>Your subscription status and renewal date.</CardDescription>
          </div>
          <Badge
            variant={isExpired ? "destructive" : isPro ? "default" : "secondary"}
            className="text-sm capitalize"
          >
            {restaurant.subscription_tier}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isExpired
              ? "Your subscription has expired."
              : `Renews / expires on ${formatDate(restaurant.subscription_end_date)}`}
          </p>
          {!isExpired && (
            <p className="text-sm text-muted-foreground">
              {daysLeft} day{daysLeft === 1 ? "" : "s"} remaining
            </p>
          )}

          {pendingRenewalId && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              A renewal payment is awaiting Hilaac confirmation. Your plan will unlock as soon as
              it is confirmed.
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <BrandButton onClick={() => void openPay("renew")} disabled={!!pendingRenewalId}>
              <Smartphone className="h-4 w-4" />
              Renew now — {formatCurrency(renewAmount)}
            </BrandButton>
            {!isPro && (
              <Button
                variant="outline"
                onClick={() => void openPay("upgrade_pro")}
                disabled={!!pendingRenewalId}
              >
                <Crown className="h-4 w-4" /> Upgrade to Pro — $79
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        {Object.entries(PLANS).map(([key, plan]) => (
          <Card
            key={key}
            className={
              restaurant.subscription_tier === key || (key === "pro" && isPro)
                ? cn("border-2", adminBrandBorderClass)
                : ""
            }
          >
            <CardHeader>
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <div className="text-3xl font-bold">{plan.priceLabel}</div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", adminBrandTextClass)} />{" "}
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {intent === "upgrade_pro"
                ? "Upgrade to Pro — $79/mo"
                : `Renew ${ussd?.planName ?? PLANS[renewTier].name} — ${ussd?.priceLabel ?? PLANS[renewTier].priceLabel}`}
            </DialogTitle>
            <DialogDescription>
              Pay Hilaac via mobile money, then submit. A Super Admin will confirm — same pattern as
              cashier payment confirmation.
            </DialogDescription>
          </DialogHeader>

          {loadingUssd || !ussd ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading payment codes…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <BrandButton variant="success" size="lg" onClick={() => dial("evc")}>
                  <Smartphone className="h-4 w-4" /> Ku bixi EVC
                </BrandButton>
                <Button variant="warning" size="lg" onClick={() => dial("edahab")}>
                  <Smartphone className="h-4 w-4" /> Ku bixi eDahab
                </Button>
              </div>

              {method && (
                <div className="space-y-3 rounded-lg border bg-muted/50 p-4 text-sm">
                  <p>
                    Dialing{" "}
                    <span className="font-mono font-semibold">{ussd.dial[method]}</span> for{" "}
                    <span className="font-semibold">{formatCurrency(ussd.amount)}</span>. Once
                    you&apos;ve paid, optionally enter the SMS reference and submit.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-tx-ref">Transaction reference (optional)</Label>
                    <Input
                      id="billing-tx-ref"
                      value={txRef}
                      onChange={(e) => setTxRef(e.target.value)}
                      placeholder="e.g. SMS confirmation code"
                      autoComplete="off"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <BrandButton
              onClick={() => void handleSubmitRenewal()}
              disabled={!method || submitting || loadingUssd}
              className="w-full"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Haa, waan bixiyay (Yes, I&apos;ve paid)
            </BrandButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
