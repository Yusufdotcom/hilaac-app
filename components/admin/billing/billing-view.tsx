"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, Crown, Smartphone, AlertTriangle } from "lucide-react";
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
import type { RenewalIntent } from "@/lib/platform/subscription-renewal";
import { cn, formatDate, daysUntil, formatCurrency } from "@/lib/utils";
import type { Restaurant } from "@/types/database";

type PayIntent = RenewalIntent;
type PlanKey = "starter" | "pro";

type UssdPayload = {
  tier: PlanKey;
  amount: number;
  priceLabel: string;
  planName: string;
  intent?: PayIntent;
  dial: { evc: string; edahab: string };
};

const DOWNGRADE_LOSSES = [
  "AI menu image generator",
  "Direct API mobile money payments (reverts to USSD)",
  "Unlimited staff accounts (Starter allows up to 3)",
  "Priority support",
] as const;

export function BillingView({ restaurant }: { restaurant: Restaurant }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payOpen, setPayOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [intent, setIntent] = useState<PayIntent>("renew");
  const [ussd, setUssd] = useState<UssdPayload | null>(null);
  const [loadingUssd, setLoadingUssd] = useState(false);
  const [method, setMethod] = useState<"evc" | "edahab" | null>(null);
  const [txRef, setTxRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingRenewalId, setPendingRenewalId] = useState<string | null>(null);

  const daysLeft = daysUntil(restaurant.subscription_end_date);
  const isPro = restaurant.subscription_tier === "pro";
  const currentPlanKey: PlanKey = isPro ? "pro" : "starter";
  const isExpired = restaurant.subscription_status === "expired" || daysLeft < 0;

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
      const res = await fetch(`/api/admin/subscriptions/ussd?intent=${nextIntent}`, {
        cache: "no-store",
      });
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

  function requestPlanAction(planKey: PlanKey) {
    if (pendingRenewalId) return;
    if (planKey === currentPlanKey) {
      void openPay("renew");
      return;
    }
    if (planKey === "pro") {
      void openPay("upgrade_pro");
      return;
    }
    setDowngradeOpen(true);
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

  function payDialogTitle() {
    if (intent === "upgrade_pro") {
      return `Upgrade to Pro — ${ussd?.priceLabel ?? PLANS.pro.priceLabel}`;
    }
    if (intent === "switch_starter") {
      return `Switch to Starter — ${ussd?.priceLabel ?? PLANS.starter.priceLabel}`;
    }
    return `Renew ${ussd?.planName ?? PLANS[currentPlanKey].name} — ${ussd?.priceLabel ?? PLANS[currentPlanKey].priceLabel}`;
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
              A payment is awaiting Hilaac confirmation. Your plan will update as soon as it is
              confirmed.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        {(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(([key, plan]) => {
          const isCurrent = currentPlanKey === key;
          return (
            <Card
              key={key}
              className={isCurrent ? cn("border-2", adminBrandBorderClass) : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                <div className="text-3xl font-bold">{plan.priceLabel}</div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2
                        className={cn("mt-0.5 h-4 w-4 shrink-0", adminBrandTextClass)}
                      />{" "}
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <BrandButton
                    className="w-full"
                    onClick={() => requestPlanAction(key)}
                    disabled={!!pendingRenewalId}
                  >
                    <Smartphone className="h-4 w-4" />
                    Renew now — {formatCurrency(plan.price)}
                  </BrandButton>
                ) : key === "pro" ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => requestPlanAction("pro")}
                    disabled={!!pendingRenewalId}
                  >
                    <Crown className="h-4 w-4" />
                    Upgrade to Pro — {formatCurrency(PLANS.pro.price)}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => requestPlanAction("starter")}
                    disabled={!!pendingRenewalId}
                  >
                    Switch to Starter — {formatCurrency(PLANS.starter.price)}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={downgradeOpen} onOpenChange={setDowngradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Switch to Starter?
            </DialogTitle>
            <DialogDescription>
              You will lose Pro-only features as soon as Hilaac confirms payment. Switching starts a
              fresh 30-day Starter period (remaining Pro days are not carried over).
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            {DOWNGRADE_LOSSES.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                {item}
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDowngradeOpen(false)}>
              Keep Pro
            </Button>
            <BrandButton
              type="button"
              onClick={() => {
                setDowngradeOpen(false);
                void openPay("switch_starter");
              }}
            >
              Continue to pay {formatCurrency(PLANS.starter.price)}
            </BrandButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{payDialogTitle()}</DialogTitle>
            <DialogDescription>
              Pay Hilaac via mobile money, then submit. A Super Admin will confirm — same pattern as
              cashier payment confirmation.
              {intent !== "renew" && (
                <>
                  {" "}
                  On confirmation your plan switches immediately and a new 30-day period starts.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingUssd || !ussd ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading payment codes…
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Amount to dial:{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(ussd.amount)}
                </span>{" "}
                ({ussd.planName})
              </p>
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
