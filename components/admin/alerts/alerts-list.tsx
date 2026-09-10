import Link from "next/link";
import { cn } from "@/lib/utils";
import type { RestaurantAlert, AlertSeverity } from "@/lib/alerts/types";

const SEVERITY_STYLES: Record<
  AlertSeverity,
  { card: string; dot: string; label: string; button: string }
> = {
  urgent: {
    card: "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/35",
    dot: "bg-red-500",
    label: "text-red-800 dark:text-red-200",
    button: "bg-red-600 text-white hover:bg-red-700",
  },
  important: {
    card: "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/35",
    dot: "bg-amber-500",
    label: "text-amber-900 dark:text-amber-100",
    button: "bg-amber-600 text-white hover:bg-amber-700",
  },
  normal: {
    card: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/35",
    dot: "bg-emerald-500",
    label: "text-emerald-900 dark:text-emerald-100",
    button: "bg-emerald-700 text-white hover:bg-emerald-800",
  },
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  urgent: "URGENT",
  important: "IMPORTANT",
  normal: "NORMAL",
};

export function AlertsList({ alerts }: { alerts: RestaurantAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">All clear</p>
        <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
          No urgent payment, billing, or margin alerts right now.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {alerts.map((alert) => {
        const styles = SEVERITY_STYLES[alert.severity];
        return (
          <li
            key={alert.id}
            className={cn(
              "rounded-2xl border px-4 py-4 sm:px-5 sm:py-5",
              styles.card
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", styles.dot)}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-xs font-bold uppercase tracking-wide",
                    styles.label
                  )}
                >
                  {SEVERITY_LABEL[alert.severity]}
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--admin-text,#0F172A)]">
                  {alert.title}
                </p>
                <p className="mt-1 text-sm text-[var(--admin-muted,#475569)]">
                  {alert.description}
                </p>
                <p className="mt-3 text-sm text-[var(--admin-text,#0F172A)]">
                  <span className="font-semibold">Why it matters:</span>{" "}
                  {alert.whyItMatters}
                </p>
                <Link
                  href={alert.href}
                  className={cn(
                    "mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                    styles.button
                  )}
                >
                  {alert.actionLabel}
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
