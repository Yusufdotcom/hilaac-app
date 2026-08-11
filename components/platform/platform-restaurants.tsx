"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

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
};

export function PlatformRestaurants() {
  const [restaurants, setRestaurants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/restaurants", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load restaurants");
      setRestaurants(data.restaurants ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">All Restaurants</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every tenant on Hilaac — plan, status, and days remaining.
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

      {loading && restaurants.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-slate-400">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Days left</th>
                  <th className="px-4 py-3 font-medium">Ends</th>
                  <th className="px-4 py-3 font-medium">Tenant admin</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.slug}</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-200">{r.subscription_tier}</td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-slate-200">
                      {r.is_expired ? 0 : Math.max(0, r.days_remaining)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatDate(r.subscription_end_date)}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/platform/open/${r.slug}`}
                        className="text-amber-300 underline-offset-2 hover:underline"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
