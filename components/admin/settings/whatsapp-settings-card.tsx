"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Lock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type WhatsAppSettings = {
  order_ready_enabled: boolean;
  reengagement_enabled: boolean;
  reengagement_idle_days: number;
  reengagement_min_interval_days: number;
};

type Usage = {
  month_utility_messages: number;
  month_marketing_messages: number;
  month_estimated_cost_usd: number;
  utility_unit_cost_usd: number;
  marketing_unit_cost_usd: number;
};

type Meta = {
  dry_run: boolean;
  twilio_configured: boolean;
  templates_configured: boolean;
  reengagement_allowed: boolean;
};

export function WhatsAppSettingsCard({
  slug,
  initialSettings,
  initialUsage,
  initialMeta,
}: {
  slug: string;
  initialSettings: WhatsAppSettings;
  initialUsage: Usage;
  initialMeta: Meta;
}) {
  const [orderReady, setOrderReady] = useState(initialSettings.order_ready_enabled);
  const [reengage, setReengage] = useState(
    initialSettings.reengagement_enabled && initialMeta.reengagement_allowed
  );
  const [idleDays, setIdleDays] = useState(String(initialSettings.reengagement_idle_days));
  const [intervalDays, setIntervalDays] = useState(
    String(initialSettings.reengagement_min_interval_days)
  );
  const [usage, setUsage] = useState(initialUsage);
  const [meta, setMeta] = useState(initialMeta);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/whatsapp/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          order_ready_enabled: orderReady,
          reengagement_enabled: reengage,
          reengagement_idle_days: Number(idleDays),
          reengagement_min_interval_days: Number(intervalDays),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.success("WhatsApp settings saved");

      const refresh = await fetch(
        `/api/admin/whatsapp/settings?slug=${encodeURIComponent(slug)}`
      );
      const refreshed = await refresh.json().catch(() => ({}));
      if (refresh.ok) {
        if (refreshed.usage) setUsage(refreshed.usage);
        if (refreshed.meta) setMeta(refreshed.meta);
        if (refreshed.settings) {
          setOrderReady(Boolean(refreshed.settings.order_ready_enabled));
          setReengage(Boolean(refreshed.settings.reengagement_enabled));
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          WhatsApp Notifications
        </CardTitle>
        <CardDescription>
          Order-ready alerts (all plans) and optional come-back offers (Pro). Uses Twilio + Meta
          WhatsApp templates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Order-ready this month</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{usage.month_utility_messages}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Re-engagement this month</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{usage.month_marketing_messages}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Est. cost this month</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatCurrency(usage.month_estimated_cost_usd)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              ~{formatCurrency(usage.utility_unit_cost_usd)} utility · ~
              {formatCurrency(usage.marketing_unit_cost_usd)} marketing
            </p>
          </div>
        </div>

        {(meta.dry_run || !meta.twilio_configured) && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {meta.dry_run
              ? "Dry-run mode is on (WHATSAPP_DRY_RUN). Messages are logged but not sent."
              : "Twilio is not fully configured yet. Add credentials in Vercel to enable live sends."}
          </p>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1 pr-4">
              <Label htmlFor="wa-order-ready" className="text-sm font-medium">
                Order ready notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                WhatsApp the customer when kitchen marks an order Ready.
              </p>
            </div>
            <Switch id="wa-order-ready" checked={orderReady} onCheckedChange={setOrderReady} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1 pr-4">
              <Label htmlFor="wa-reengage" className="text-sm font-medium">
                Re-engagement offers{" "}
                {!meta.reengagement_allowed && (
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <Lock className="h-3 w-3" /> Pro
                  </span>
                )}
              </Label>
              <p className="text-sm text-muted-foreground">
                Occasional “come back” marketing templates for opted-in customers. Costs apply.
              </p>
              {!meta.reengagement_allowed && (
                <Link href={`/admin/${slug}/billing`} className="text-xs font-medium underline">
                  Upgrade to Pro
                </Link>
              )}
            </div>
            <Switch
              id="wa-reengage"
              checked={reengage}
              disabled={!meta.reengagement_allowed}
              onCheckedChange={setReengage}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wa-idle">Days since last order</Label>
              <Input
                id="wa-idle"
                type="number"
                min={7}
                max={90}
                value={idleDays}
                onChange={(e) => setIdleDays(e.target.value)}
                disabled={!meta.reengagement_allowed}
              />
              <p className="text-xs text-muted-foreground">Default 14 — customer must be idle this long</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-interval">Min days between offers</Label>
              <Input
                id="wa-interval"
                type="number"
                min={14}
                max={60}
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                disabled={!meta.reengagement_allowed}
              />
              <p className="text-xs text-muted-foreground">Default 21 — never spam the same number</p>
            </div>
          </div>

          <BrandButton type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save WhatsApp Settings
          </BrandButton>
        </form>
      </CardContent>
    </Card>
  );
}
