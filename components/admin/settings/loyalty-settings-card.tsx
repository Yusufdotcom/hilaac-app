"use client";

import { useState } from "react";
import { Gift, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoyaltyAdminStats, LoyaltySettings } from "@/lib/loyalty/types";

const DEFAULT_SETTINGS: Omit<LoyaltySettings, "restaurant_id"> = {
  enabled: false,
  target_order_count: 5,
  reward_description: "Free item",
};

export function LoyaltySettingsCard({
  slug,
  initialSettings,
  initialStats,
}: {
  slug: string;
  restaurantId: string;
  initialSettings: LoyaltySettings | null;
  initialStats: LoyaltyAdminStats;
}) {
  const [enabled, setEnabled] = useState(initialSettings?.enabled ?? DEFAULT_SETTINGS.enabled);
  const [target, setTarget] = useState(
    String(initialSettings?.target_order_count ?? DEFAULT_SETTINGS.target_order_count)
  );
  const [reward, setReward] = useState(
    initialSettings?.reward_description ?? DEFAULT_SETTINGS.reward_description
  );
  const [stats, setStats] = useState(initialStats);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/loyalty/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          enabled,
          target_order_count: Number(target),
          reward_description: reward.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.success("Loyalty program saved");

      const refresh = await fetch(`/api/admin/loyalty/settings?slug=${encodeURIComponent(slug)}`);
      const refreshed = await refresh.json().catch(() => ({}));
      if (refresh.ok && refreshed.stats) setStats(refreshed.stats);
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
          <Gift className="h-5 w-5 text-amber-500" aria-hidden="true" />
          Loyalty Program
        </CardTitle>
        <CardDescription>
          Punch-card rewards for every plan — customers earn progress when orders are marked
          delivered. Available on all subscription tiers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Customers with progress</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.customers_with_progress}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Rewards waiting</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.customers_with_rewards}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Total redeemed</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.total_redemptions}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1 pr-4">
              <Label htmlFor="loyalty-enabled" className="text-sm font-medium">
                Enable loyalty program
              </Label>
              <p className="text-sm text-muted-foreground">
                Show progress on the order status page and allow cashiers to redeem rewards.
              </p>
            </div>
            <Switch id="loyalty-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loyalty-target">Orders needed for a reward</Label>
              <Input
                id="loyalty-target"
                type="number"
                min={2}
                max={100}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Example: 5 orders → 1 reward</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="loyalty-reward">Reward description</Label>
              <Input
                id="loyalty-reward"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                maxLength={120}
                placeholder="Free Delish Burg or $3 off"
                required
              />
            </div>
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Progress is tracked by phone number for this restaurant only. A reward is earned when the
            punch card fills; cashiers redeem it manually after confirming with the customer.
          </p>

          <BrandButton type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Loyalty Settings
          </BrandButton>
        </form>
      </CardContent>
    </Card>
  );
}
