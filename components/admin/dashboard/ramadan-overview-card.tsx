import Link from "next/link";
import { Moon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { RamadanOverview } from "@/lib/somali-airlines/season-ops";

export function RamadanOverviewCard({
  slug,
  overview,
}: {
  slug: string;
  overview: RamadanOverview;
}) {
  const label = overview.season === "eid" ? "Eid" : "Ramadan";

  return (
    <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--admin-muted,#64748B)]">
            <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            {label} Overview
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-[var(--admin-text,#0F172A)]">
            {formatCurrency(overview.precollectedRevenue)}
          </p>
          <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
            Pre-collected from {overview.paidSubscriptions} paid pass
            {overview.paidSubscriptions === 1 ? "" : "es"}
          </p>
        </div>
        <Link
          href={`/admin/${slug}/packages`}
          className="text-xs font-semibold text-[var(--admin-brand,#9E2E2E)] hover:underline"
        >
          Packages →
        </Link>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--admin-border,#E2E8F0)] pt-4 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-muted,#64748B)]">
            Normal tonight
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-[var(--admin-text,#0F172A)]">
            {overview.normalCheckedIn}/{overview.normalPaid}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-muted,#64748B)]">
            Buffet tonight
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-[var(--admin-text,#0F172A)]">
            {overview.buffetCheckedIn}/{overview.buffetPaid}
            {overview.buffetCapacity != null ? ` · cap ${overview.buffetCapacity}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-muted,#64748B)]">
            No-shows so far
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-[var(--admin-text,#0F172A)]">
            {overview.noShowsEstimate}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--admin-muted,#64748B)]">
            Buffet fill
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-[var(--admin-text,#0F172A)]">
            {overview.buffetCapacity != null
              ? `${overview.buffetOccupancy}/${overview.buffetCapacity}`
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
