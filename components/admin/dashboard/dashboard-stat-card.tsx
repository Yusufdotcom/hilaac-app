import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel = "vs yesterday",
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  /** Percent change; null → muted “no change” */
  delta: number | null;
  deltaLabel?: string;
}) {
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;

  return (
    <div className="admin-glass-hover rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-xs text-[var(--admin-muted,#64748B)]">{label}</p>
          <p className="text-2xl font-bold text-[var(--admin-text,#0F172A)]">{value}</p>
        </div>
        <span className="admin-brand-tint flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p
        className={cn(
          "mt-3 text-xs font-semibold",
          up && "text-emerald-600",
          down && "text-red-600",
          delta == null && "text-[var(--admin-muted,#94A3B8)]",
          delta === 0 && "text-[var(--admin-muted,#94A3B8)]"
        )}
      >
        {delta == null || delta === 0 ? (
          <>— no change</>
        ) : (
          <>
            {up ? "↑" : "↓"} {Math.abs(delta)}%{" "}
            <span className="font-normal text-[var(--admin-muted,#94A3B8)]">{deltaLabel}</span>
          </>
        )}
      </p>
    </div>
  );
}
