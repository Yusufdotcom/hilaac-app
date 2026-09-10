"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, Crown, Smartphone, AlertTriangle, Plane } from "lucide-react";
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
import { PLANS, tierDisplayName } from "@/lib/constants";
import {
  billingCardForTier,
  intentForBillingCard,
  type RenewalIntent,
} from "@/lib/platform/subscription-renewal";
import type { NewBillableTier } from "@/lib/billing/tier-capabilities";
import { cn, formatDate, daysUntil, formatCurrency } from "@/lib/utils";
import type { Restaurant } from "@/types/database";

type PayIntent = RenewalIntent;
type PlanKey = NewBillableTier;

type UssdPayload = {
  tier: string;
  amount: number;
  priceLabel: string;
  planName: string;
  intent?: PayIntent;
  dial: { evc: string; edahab: string };
};

const BILLING_CARDS: PlanKey[] = ["goronyo", "gorgor", "galeyr", "somali_airlines"];

const PLAN_RANK: Record<PlanKey, number> = {
  goronyo: 1,
  gorgor: 2,
  galeyr: 3,
  somali_airlines: 4,
};

const DOWNGRADE_LOSSES: Record<PlanKey, string[]> = {
  goronyo: [
    "API auto-payment (reverts to USSD)",
    "AI menu image generator",
    "Advanced reports + Insights + export",
    "Recap email delivery",
    "Unlimited staff / multi-branch",
    "AI Business Chatbot and Galeyr tools",
    "Ramadan / Events (Somali Airlines)",
  ],
  gorgor: [
    "AI Business Chatbot (Galeyr exclusive)",
    "Expenses / P&L",
    "Staff performance + scheduling",
    "Customer intelligence",
    "Ramadan / Events (Somali Airlines)",
  ],
  galeyr: [
    "Ramadan + Eid packages",
    "Wedding & event hall management",
    "Online booking link",
    "Post-event profit reports",
  ],
  somali_airlines: [],
};

export function BillingView({ restaurant }: { restaurant: Restaurant }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payOpen, setPayOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<PlanKey | null>(null);
  const [intent, setIntent] = useState<PayIntent>("renew");
  const [ussd, setUssd] = useState<UssdPayload | null>(null);
  const [loadingUssd, setLoadingUssd] = useState(false);
  const [method, setMethod] = useState<"evc" | "edahab" | null>(null);
  const [txRef, setTxRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingRenewalId, setPendingRenewalId] = useState<string | null>(null);

  const daysLeft = daysUntil(restaurant.subscription_end_date);
  const currentCard = billingCardForTier(restaurant.subscription_tier);
  const isExpired = restaurant.subscription_status === "expired" || daysLeft < 0;
  const isPremium = currentCard !== "goronyo";

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
    const nextIntent = intentForBillingCard(restaurant.subscription_tier, planKey);
    if (nextIntent === "renew") {
      void openPay("renew");
      return;
    }
    if (PLAN_RANK[planKey] < PLAN_RANK[currentCard]) {
      setPendingTarget(planKey);
      setDowngradeOpen(true);
      return;
    }
    void openPay(nextIntent);
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
    if (intent.startsWith("switch_")) {
      return `Switch to ${ussd?.planName ?? "plan"} — ${ussd?.priceLabel ?? ""}`;
    }
    return `Renew ${ussd?.planName ?? tierDisplayName(restaurant.subscription_tier)} — ${ussd?.priceLabel ?? ""}`;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              Current Plan
              {isPremium && <Crown className={cn("h-5 w-5", adminBrandTextClass)} />}
            </CardTitle>
            <CardDescription>Your subscription status and renewal date.</CardDescription>
          </div>
          <Badge
            variant={isExpired ? "destructive" : isPremium ? "default" : "secondary"}
            className="text-sm"
          >
            {tierDisplayName(restaurant.subscription_tier)}
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

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {BILLING_CARDS.map((key) => {
          const plan = PLANS[key];
          const isCurrent = currentCard === key;
          const isAirlines = key === "somali_airlines";
          return (
            <Card
              key={key}
              className={cn(
                isCurrent && cn("border-2", adminBrandBorderClass),
                isAirlines &&
                  "border-[#D4A373]/40 bg-gradient-to-b from-[#0F172A] to-[#1E293B] text-white shadow-md"
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle
                    className={cn(
                      "flex items-center gap-2 text-lg",
                      isAirlines && "text-[#D4A373]"
                    )}
                  >
                    {isAirlines ? <Plane className="h-5 w-5 shrink-0" aria-hidden="true" /> : null}
                    {plan.name}
                  </CardTitle>
                  {isCurrent && (
                    <Badge
                      variant="secondary"
                      className={cn("text-xs", isAirlines && "bg-[#D4A373]/20 text-[#D4A373]")}
                    >
                      Current
                    </Badge>
                  )}
                </div>
                <div className={cn("text-3xl font-bold", isAirlines && "text-white")}>
                  {plan.priceLabel}
                </div>
                <CardDescription className={cn(isAirlines && "text-slate-300")}>
                  {isAirlines
                    ? "For restaurants that do it all — events, halls, Ramadan packages."
                    : plan.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className={cn("space-y-2 text-sm", isAirlines && "text-slate-200")}>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          isAirlines ? "text-[#D4A373]" : adminBrandTextClass
                        )}
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
                ) : (
                  <Button
                    className={cn(
                      "w-full",
                      isAirlines &&
                        "border-[#D4A373]/50 bg-[#D4A373] text-[#0F172A] hover:bg-[#D4A373]/90"
                    )}
                    variant={isAirlines ? "default" : "outline"}
                    onClick={() => requestPlanAction(key)}
                    disabled={!!pendingRenewalId}
                  >
                    {key === "somali_airlines" ||
                    key === "galeyr" ||
                    (key === "gorgor" && currentCard === "goronyo") ? (
                      key === "somali_airlines" ? (
                        <Plane className="h-4 w-4" />
                      ) : (
                        <Crown className="h-4 w-4" />
                      )
                    ) : null}
                    Switch to {plan.name} — {formatCurrency(plan.price)}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={downgradeOpen}
        onOpenChange={(open) => {
          setDowngradeOpen(open);
          if (!open) setPendingTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Switch to {pendingTarget ? PLANS[pendingTarget].name : "a lower plan"}?
            </DialogTitle>
            <DialogDescription>
              You will lose higher-tier features as soon as Hilaac confirms payment. Switching
              starts a fresh 30-day period (remaining days on your current plan are not carried
              over).
            </DialogDescription>
          </DialogHeader>
          {pendingTarget && DOWNGRADE_LOSSES[pendingTarget].length > 0 ? (
            <ul className="space-y-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              {DOWNGRADE_LOSSES[pendingTarget].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDowngradeOpen(false)}>
              Keep current plan
            </Button>
            <BrandButton
              type="button"
              onClick={() => {
                if (!pendingTarget) return;
                const next = intentForBillingCard(restaurant.subscription_tier, pendingTarget);
                setDowngradeOpen(false);
                void openPay(next);
              }}
            >
              Continue to pay{" "}
              {pendingTarget ? formatCurrency(PLANS[pendingTarget].price) : ""}
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
