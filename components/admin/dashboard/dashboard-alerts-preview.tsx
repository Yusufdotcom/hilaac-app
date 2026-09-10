import Link from "next/link";
import { AlertTriangle, CreditCard, TrendingDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RestaurantAlert } from "@/lib/alerts/types";

export function DashboardAlertsPreview({
  items,
  slug,
}: {
  items: RestaurantAlert[];
  slug: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">Top Alerts</h3>
        <Link
          href={`/admin/${slug}/alerts`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-muted,#64748B)] hover:text-[var(--admin-text,#0F172A)]"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      <ul className="space-y-2">
        {items.slice(0, 3).map((item) => {
          const urgent = item.severity === "urgent";
          const important = item.severity === "important";
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors hover:opacity-95",
                  urgent
                    ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                    : important
                      ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
                )}
              >
                <span className="mt-0.5 shrink-0">
                  {urgent ? (
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                  ) : important ? (
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide">
                    {urgent ? "Urgent" : important ? "Important" : "Normal"}
                  </p>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs opacity-80">{item.description}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
