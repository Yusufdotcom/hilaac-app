import { cn } from "@/lib/utils";
import type { BusinessHealthResult } from "@/lib/dashboard/business-health";

export function BusinessHealthCard({ health }: { health: BusinessHealthResult }) {
  const pill =
    health.status === "HEALTHY"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : health.status === "NEEDS ATTENTION"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300";

  const bar =
    health.status === "HEALTHY"
      ? "bg-emerald-500"
      : health.status === "NEEDS ATTENTION"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="admin-glass-hover flex h-full flex-col rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--admin-muted,#64748B)]">
          Business Health Score
        </p>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            pill
          )}
        >
          {health.status}
        </span>
      </div>
      <p className="mt-3 text-5xl font-bold tabular-nums text-[var(--admin-text,#0F172A)]">
        {health.score}
      </p>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--admin-subtle,#F1F5F9)]">
        <div
          className={cn("h-full rounded-full transition-all", bar)}
          style={{ width: `${Math.max(0, Math.min(100, health.score))}%` }}
          role="progressbar"
          aria-valuenow={health.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Business health score"
        />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[var(--admin-muted,#64748B)]">
        {health.explanation}
      </p>
    </div>
  );
}
