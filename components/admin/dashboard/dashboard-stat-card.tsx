import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

function Sparkline({ values }: { values: number[] }) {
  const series = (values.length === 7 ? values : [...values, ...Array(7).fill(0)].slice(0, 7)).map(
    (v, i) => ({ day: i + 1, value: Number(v) || 0 })
  );
  const max = Math.max(...series.map((d) => d.value), 1);

  return (
    <div className="mt-3 h-10 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[0, max]} />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--admin-brand, #9E2E2E) 12%, transparent)" }}
            contentStyle={{
              background: "var(--admin-card, #fff)",
              border: "1px solid var(--admin-border, #E2E8F0)",
              borderRadius: 8,
              fontSize: 11,
              color: "var(--admin-text, #0F172A)",
            }}
            formatter={(value) => [value ?? 0, ""]}
            labelFormatter={() => ""}
          />
          <Bar
            dataKey="value"
            fill="color-mix(in srgb, var(--admin-brand, #9E2E2E) 55%, transparent)"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel = "vs yesterday",
  sparkline,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  /** Percent change; null → muted “no change” */
  delta: number | null;
  deltaLabel?: string;
  /** Last 7 daily values for the mini bar chart. */
  sparkline?: number[];
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
      {/* Always render 7-day trend strip (zeros when no history). */}
      <Sparkline values={sparkline ?? [0, 0, 0, 0, 0, 0, 0]} />
      <p
        className={cn(
          "mt-3 text-xs font-semibold",
          up && "text-emerald-600 dark:text-emerald-400",
          down && "text-red-600 dark:text-red-400",
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
