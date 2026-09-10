"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Restaurant } from "@/types/database";

const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

function toInputTime(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function BusinessHoursCard({ restaurant }: { restaurant: Restaurant }) {
  const [opening, setOpening] = useState(toInputTime(restaurant.opening_time));
  const [closing, setClosing] = useState(toInputTime(restaurant.closing_time));
  const [days, setDays] = useState<number[]>(
    restaurant.business_days?.length ? [...restaurant.business_days] : [0, 1, 2, 3, 4, 5, 6]
  );
  const [saving, setSaving] = useState(false);

  function toggleDay(value: number) {
    setDays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if ((opening && !closing) || (!opening && closing)) {
      toast.error("Set both opening and closing time, or leave both empty for 24-hour days.");
      return;
    }
    if (days.length === 0) {
      toast.error("Pick at least one business day, or leave all selected for every day.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/restaurant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          opening_time: opening || null,
          closing_time: closing || null,
          business_days: days,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "aal2_required") {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/auth/mfa/challenge?next=${next}`;
          return;
        }
        throw new Error(data.error ?? "Failed to save");
      }
      toast.success(
        opening && closing
          ? "Business hours saved — recaps will follow this shift."
          : "24-hour calendar days restored for recaps."
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save hours");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg">Business hours</CardTitle>
        <CardDescription>
          Used for daily recaps only. Leave times empty to keep 24-hour calendar days (East Africa
          Time). If you close after midnight (for example 2:00 AM), that night still belongs to the
          day you opened — not midnight-to-midnight.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="opening_time">Opening time</Label>
              <Input
                id="opening_time"
                type="time"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closing_time">Closing time</Label>
              <Input
                id="closing_time"
                type="time"
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Days of business</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_OPTIONS.map((d) => {
                const on = days.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={
                      on
                        ? "rounded-lg bg-[var(--admin-brand,#0F172A)] px-2.5 py-1.5 text-xs font-semibold text-white"
                        : "rounded-lg border border-[var(--admin-border,#E2E8F0)] px-2.5 py-1.5 text-xs font-medium text-[var(--admin-muted,#64748B)]"
                    }
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
          <BrandButton type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save hours
          </BrandButton>
        </form>
      </CardContent>
    </Card>
  );
}
