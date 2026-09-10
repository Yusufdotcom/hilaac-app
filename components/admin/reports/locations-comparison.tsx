"use client";

import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { BranchComparisonRow } from "@/lib/reports/fetch-branch-comparison";

export function LocationsComparison({ slug }: { slug: string }) {
  const [rows, setRows] = useState<BranchComparisonRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/reports/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, granularity: "monthly" }),
        });
        const json = (await res.json()) as { rows?: BranchComparisonRow[]; error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load locations");
        if (!cancelled) setRows(json.rows ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-[var(--admin-muted,#64748B)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading locations…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-[var(--admin-muted,#64748B)]">
        No locations found for this account.
      </p>
    );
  }

  if (rows.length < 2) {
    return (
      <p className="text-sm text-[var(--admin-muted,#64748B)]">
        Add another branch to compare locations. You currently have one location.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--admin-muted,#64748B)]">
        Monthly comparison across your branches. Best performer is marked with a star and “Best”
        label.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-[var(--admin-bg,#F8FAFC)] text-left text-[var(--admin-muted,#64748B)]">
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold">Orders</th>
              <th className="px-4 py-3 font-semibold">Revenue</th>
              <th className="px-4 py-3 font-semibold">Avg Order</th>
              <th className="px-4 py-3 font-semibold">Top Item</th>
              <th className="px-4 py-3 font-semibold">Growth %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.restaurantId} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium text-[var(--admin-text,#0F172A)]">
                  <span className="inline-flex items-center gap-2">
                    {r.location}
                    {r.isBest ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" aria-hidden="true" />
                        Best
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">{r.orders}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(r.revenue)}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(r.avgOrder)}</td>
                <td className="px-4 py-3">{r.topItem ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">
                  {r.growthPct == null ? "—" : `${r.growthPct > 0 ? "+" : ""}${r.growthPct}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
