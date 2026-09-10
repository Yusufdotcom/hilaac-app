"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { reminderCooldown } from "@/lib/platform/reminder-cooldown";
import { tierDisplayName } from "@/lib/billing/tier-capabilities";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  subscription_status: string;
  subscription_end_date: string;
  days_remaining: number;
  is_expired: boolean;
  is_active: boolean;
  is_demo: boolean;
  last_subscription_reminder_at?: string | null;
};

function PlatformStatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  icon: typeof Building2;
  tone?: "default" | "warn" | "danger" | "ok";
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-300 bg-amber-500/15"
      : tone === "danger"
        ? "text-red-300 bg-red-500/15"
        : tone === "ok"
          ? "text-emerald-300 bg-emerald-500/15"
          : "text-amber-200 bg-white/5";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-xs text-slate-400">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
        </div>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClass)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function redirectToLogin() {
  window.location.assign("/login?error=session&redirectedFrom=/platform/restaurants");
}

async function readJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(res.ok ? "Empty response from server" : `Server error (${res.status})`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid server response (${res.status})`);
  }
}

export function PlatformRestaurants() {
  const [restaurants, setRestaurants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindErrors, setRemindErrors] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    let redirecting = false;
    try {
      const res = await fetch("/api/platform/restaurants", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        redirecting = true;
        setSessionExpired(true);
        redirectToLogin();
        return;
      }
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(String(data.error ?? "Failed to load restaurants"));
      setRestaurants((data.restaurants as TenantRow[]) ?? []);
    } catch (err: unknown) {
      if (redirecting) return;
      const message = err instanceof Error ? err.message : "Failed to load restaurants";
      setLoadError(message);
      toast.error(message);
    } finally {
      if (!redirecting) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = restaurants.length;
    const expired = restaurants.filter((r) => r.is_expired).length;
    const expiringSoon = restaurants.filter(
      (r) => !r.is_expired && r.days_remaining >= 0 && r.days_remaining <= 7
    ).length;
    const active = restaurants.filter((r) => !r.is_expired && r.is_active).length;
    return { total, expired, expiringSoon, active };
  }, [restaurants]);

  async function sendReminder(r: TenantRow) {
    if (reminderCooldown(r.last_subscription_reminder_at)) return;
    setRemindingId(r.id);
    setRemindErrors((prev) => {
      const next = { ...prev };
      delete next[r.id];
      return next;
    });
    try {
      const res = await fetch(`/api/platform/restaurants/${r.id}/remind`, { method: "POST" });
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true);
        redirectToLogin();
        return;
      }
      const data = await readJsonSafe(res);
      if (res.status === 429 && data.code === "reminder_cooldown") {
        const lastSentAt = typeof data.lastSentAt === "string" ? data.lastSentAt : null;
        if (lastSentAt) {
          setRestaurants((prev) =>
            prev.map((row) =>
              row.id === r.id ? { ...row, last_subscription_reminder_at: lastSentAt } : row
            )
          );
        }
        toast.message(String(data.error ?? "Already reminded recently"));
        return;
      }
      if (!res.ok || data.success === false) {
        const reason = String(data.error ?? "Reminder failed");
        throw new Error(reason);
      }
      if (data.reminder && typeof data.reminder === "object") {
        const reminder = data.reminder as { sent?: boolean; dryRun?: boolean; reason?: string };
        if (reminder.dryRun || !reminder.sent) {
          throw new Error(reminder.reason ?? "Reminder was not delivered");
        }
      }
      const lastSentAt =
        typeof data.lastSentAt === "string" ? data.lastSentAt : new Date().toISOString();
      setRestaurants((prev) =>
        prev.map((row) =>
          row.id === r.id ? { ...row, last_subscription_reminder_at: lastSentAt } : row
        )
      );
      toast.success(`Reminder email sent to ${r.name} owner`);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : "Reminder failed";
      const message = `Failed to send reminder — ${reason}`;
      setRemindErrors((prev) => ({ ...prev, [r.id]: message }));
      toast.error(message, { duration: 8000 });
    } finally {
      setRemindingId(null);
    }
  }

  if (sessionExpired) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-slate-400">
        Session expired. Redirecting to login…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
            Hilaac Platform
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">All Restaurants</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cross-tenant overview — plan, status, days remaining, and support Open.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
          {loadError}
        </div>
      ) : null}

      {loadError ? null : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PlatformStatCard label="Total tenants" value={loading ? "…" : stats.total} icon={Building2} />
          <PlatformStatCard label="Active" value={loading ? "…" : stats.active} icon={Shield} tone="ok" />
          <PlatformStatCard
            label="Expiring ≤7 days"
            value={loading ? "…" : stats.expiringSoon}
            icon={Clock}
            tone="warn"
          />
          <PlatformStatCard
            label="Expired"
            value={loading ? "…" : stats.expired}
            icon={AlertTriangle}
            tone="danger"
          />
        </div>
      )}

      {loadError ? null : loading && restaurants.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-10 text-center text-sm text-slate-400 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : restaurants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.04] px-4 py-10 text-center text-sm text-slate-400">
          No restaurants found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="px-4 py-3.5 font-medium">Name</th>
                  <th className="px-4 py-3.5 font-medium">Plan</th>
                  <th className="px-4 py-3.5 font-medium">Status</th>
                  <th className="px-4 py-3.5 font-medium">Days left</th>
                  <th className="px-4 py-3.5 font-medium">Ends</th>
                  <th className="px-4 py-3.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((r) => {
                  const cooldown = reminderCooldown(r.last_subscription_reminder_at, nowMs);
                  const reminding = remindingId === r.id;
                  return (
                  <tr
                    key={r.id}
                    className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-white">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.slug}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-200">{tierDisplayName(r.subscription_tier)}</td>
                    <td className="px-4 py-3.5">
                      <Badge
                        className={
                          r.is_expired
                            ? "bg-red-500/20 text-red-200 hover:bg-red-500/20"
                            : "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/20"
                        }
                      >
                        {r.is_expired ? "expired" : r.subscription_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-slate-200">
                      {r.is_expired ? 0 : Math.max(0, r.days_remaining)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">
                      {formatDate(r.subscription_end_date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/platform/open/${r.slug}`}
                            className="inline-flex items-center rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/25"
                          >
                            Open
                          </a>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 border-white/15 bg-transparent px-2.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
                            disabled={reminding || Boolean(cooldown)}
                            onClick={() => void sendReminder(r)}
                          >
                            {reminding ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5" />
                            )}
                            Remind
                          </Button>
                        </div>
                        {cooldown ? (
                          <p className="max-w-[16rem] text-xs text-slate-400">{cooldown.label}</p>
                        ) : remindErrors[r.id] ? (
                          <p className="max-w-[16rem] text-xs font-medium text-red-300">
                            {remindErrors[r.id]}
                          </p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
