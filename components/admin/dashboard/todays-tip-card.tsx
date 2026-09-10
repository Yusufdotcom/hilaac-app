import { Sparkles } from "lucide-react";
import type { DashboardTip } from "@/lib/dashboard/fetch-dashboard-extras";

export function TodaysTipCard({ tip }: { tip: DashboardTip }) {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 p-5 text-white sm:p-6"
      style={{
        background:
          "linear-gradient(145deg, #0f172a 0%, #1e293b 45%, #0f172a 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, var(--admin-brand, #D4A373) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
          <Sparkles className="h-4 w-4 text-[#D4A373]" aria-hidden="true" />
        </span>
        <p className="text-xs font-medium uppercase tracking-wide text-white/60">
          Today&apos;s Tip
        </p>
      </div>
      <p className="relative mt-4 text-lg font-semibold leading-snug">{tip.title}</p>
      <p className="relative mt-2 text-sm leading-relaxed text-white/70">{tip.message}</p>
    </div>
  );
}
