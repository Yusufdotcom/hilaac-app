"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

type RenewalRow = {
  id: string;
  restaurant_id: string;
  tier: string;
  amount: number;
  method: string;
  status: string;
  tx_ref: string | null;
  created_at: string;
  restaurants:
    | {
        id: string;
        name: string;
        slug: string;
        subscription_tier: string;
        subscription_status: string;
        subscription_end_date: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
        subscription_tier: string;
        subscription_status: string;
        subscription_end_date: string;
      }[]
    | null;
};

function restaurantFromJoin(row: RenewalRow) {
  const r = row.restaurants;
  if (!r) return null;
  return Array.isArray(r) ? r[0] ?? null : r;
}

export function PlatformRenewals() {
  const [renewals, setRenewals] = useState<RenewalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/renewals?status=pending_confirmation", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load renewals");
      setRenewals(data.renewals ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load renewals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmRenewal(id: string) {
    setConfirmingId(id);
    try {
      const res = await fetch(`/api/platform/renewals/${id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Confirm failed");
      toast.success("Payment confirmed — subscription updated.");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Pending Renewals</h1>
          <p className="mt-1 text-sm text-slate-400">
            Confirm USSD subscription payments after owners dial and submit a reference.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500/20 text-amber-200 hover:bg-amber-500/20">
            {renewals.length} awaiting
          </Badge>
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
      </div>

      {loading && renewals.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-slate-400">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : renewals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-10 text-center text-sm text-slate-400">
          No pending subscription payments.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="px-4 py-3 font-medium">Restaurant</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Tx ref</th>
                  <th className="px-4 py-3 font-medium">Requested</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {renewals.map((row) => {
                  const rest = restaurantFromJoin(row);
                  return (
                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 font-medium text-white">
                        {rest?.name ?? row.restaurant_id}
                        <p className="text-xs font-normal text-slate-400">{rest?.slug}</p>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-200">{row.tier}</td>
                      <td className="px-4 py-3 text-slate-200">
                        {formatCurrency(Number(row.amount))}
                      </td>
                      <td className="px-4 py-3 uppercase text-slate-200">{row.method}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        {row.tx_ref ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-500"
                          disabled={confirmingId === row.id}
                          onClick={() => void confirmRenewal(row.id)}
                        >
                          {confirmingId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          Confirm payment
                        </Button>
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
