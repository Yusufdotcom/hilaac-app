"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, TicketPercent } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOMALI_CAMPAIGN_PRESETS, normalizePromoCode } from "@/lib/campaigns/promo";
import { formatCurrency } from "@/lib/utils";
import type { Campaign } from "@/types/database";

type Analytics = Record<
  string,
  { redemptions: number; discount_given: number; revenue: number }
>;

function todayYmd() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function statusLabel(c: Campaign, today: string) {
  if (!c.is_active) return { label: "Inactive", className: "bg-slate-100 text-slate-700" };
  if (today < c.valid_from) return { label: "Scheduled", className: "bg-sky-50 text-sky-800" };
  if (today > c.valid_to) return { label: "Expired", className: "bg-red-50 text-red-700" };
  if (c.max_uses != null && c.uses_count >= c.max_uses) {
    return { label: "Maxed out", className: "bg-amber-50 text-amber-900" };
  }
  return { label: "Active", className: "bg-emerald-50 text-emerald-800" };
}

export function CampaignsView({
  slug,
  initialCampaigns,
  initialAnalytics,
  canAnalytics,
  gated,
}: {
  slug: string;
  initialCampaigns: Campaign[];
  initialAnalytics: Analytics | null;
  canAnalytics: boolean;
  gated?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("10");
  const [validFrom, setValidFrom] = useState(todayYmd());
  const [validTo, setValidTo] = useState(todayYmd());
  const [maxUses, setMaxUses] = useState("");
  const [minOrder, setMinOrder] = useState("");

  const today = useMemo(() => todayYmd(), []);

  if (gated) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">Campaigns unavailable</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={`/admin/${slug}/billing`}>View billing</Link>
        </Button>
      </div>
    );
  }

  async function refresh() {
    const res = await fetch("/api/admin/campaigns", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setCampaigns(json.campaigns ?? []);
      setAnalytics(json.analytics ?? null);
    }
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        code: normalizePromoCode(code),
        discount_type: discountType,
        discount_value: Number(discountValue),
        valid_from: validFrom,
        valid_to: validTo,
        max_uses: maxUses || null,
        min_order_amount: minOrder || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not create campaign");
      return;
    }
    setShowForm(false);
    setName("");
    setCode("");
    setDiscountValue("10");
    setMaxUses("");
    setMinOrder("");
    await refresh();
    startTransition(() => router.refresh());
  }

  async function toggleActive(c: Campaign) {
    setError(null);
    const res = await fetch("/api/admin/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, is_active: !c.is_active }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Update failed");
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminPageIntro>
          Promo codes for QR checkout. Customers enter a code before placing an order.
        </AdminPageIntro>
        <Button type="button" onClick={() => setShowForm((v) => !v)}>
          <TicketPercent className="mr-2 h-4 w-4" />
          {showForm ? "Close form" : "Create Campaign"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(e) => void createCampaign(e)}
          className="space-y-4 rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5"
        >
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted,#64748B)]">
              Somali market quick-fill
            </p>
            <div className="flex flex-wrap gap-2">
              {SOMALI_CAMPAIGN_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="rounded-full border border-[var(--admin-border,#E2E8F0)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--admin-bg,#F8FAFC)]"
                  onClick={() => {
                    setName(p.name);
                    setCode(normalizePromoCode(p.name));
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="camp-name">Name</Label>
              <Input id="camp-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="camp-code">Promo code</Label>
              <Input
                id="camp-code"
                value={code}
                onChange={(e) => setCode(normalizePromoCode(e.target.value))}
                placeholder="RAMADAN10"
                required
              />
            </div>
            <div>
              <Label>Discount type</Label>
              <Select
                value={discountType}
                onValueChange={(v) => setDiscountType(v as "percentage" | "fixed")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="camp-value">Discount value</Label>
              <Input
                id="camp-value"
                type="number"
                min={0.01}
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="camp-from">Valid from</Label>
              <Input
                id="camp-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="camp-to">Valid to</Label>
              <Input
                id="camp-to"
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="camp-max">Max uses (optional)</Label>
              <Input
                id="camp-max"
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <div>
              <Label htmlFor="camp-min">Min order $ (optional)</Label>
              <Input
                id="camp-min"
                type="number"
                min={0}
                step="0.01"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save campaign
          </Button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)]">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b bg-[var(--admin-bg,#F8FAFC)] text-left text-[var(--admin-muted,#64748B)]">
              <th className="px-4 py-3 font-semibold">Campaign</th>
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">Discount</th>
              <th className="px-4 py-3 font-semibold">Uses</th>
              <th className="px-4 py-3 font-semibold">Expiry</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              {canAnalytics ? (
                <th className="px-4 py-3 font-semibold">Analytics</th>
              ) : null}
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td
                  colSpan={canAnalytics ? 8 : 7}
                  className="px-4 py-8 text-center text-[var(--admin-muted,#64748B)]"
                >
                  No campaigns yet.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => {
                const st = statusLabel(c, today);
                const a = analytics?.[c.id];
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                    <td className="px-4 py-3">
                      {c.discount_type === "percentage"
                        ? `${c.discount_value}%`
                        : formatCurrency(Number(c.discount_value))}
                    </td>
                    <td className="px-4 py-3">
                      {c.uses_count}
                      {c.max_uses != null ? ` / ${c.max_uses}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      {c.valid_from} → {c.valid_to}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.className}`}>
                        {st.label}
                      </span>
                    </td>
                    {canAnalytics ? (
                      <td className="px-4 py-3 text-xs text-[var(--admin-muted,#64748B)]">
                        {a ? (
                          <>
                            {a.redemptions} redemptions · −
                            {formatCurrency(a.discount_given)} · rev{" "}
                            {formatCurrency(a.revenue)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void toggleActive(c)}
                      >
                        {c.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!canAnalytics ? (
        <p className="text-xs text-[var(--admin-muted,#64748B)]">
          Campaign analytics (redemptions, discount given, revenue) unlock on Gorgor 1.0 and above.
        </p>
      ) : null}
    </div>
  );
}
