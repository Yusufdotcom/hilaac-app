"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DEMO_SCORE = 82;
const DEMO_STATUS = "HEALTHY";
const DEMO_BREAKDOWN = [
  { label: "Today's revenue", value: "$1,240" },
  { label: "Open orders", value: "7" },
  { label: "Top seller", value: "Camel stew" },
  { label: "Low stock alerts", value: "1" },
] as const;

/**
 * Marketing-only Business Health Score preview for the landing hero.
 * Sample numbers — clearly labeled Demo so it is never confused with live data.
 */
export function HealthScoreDemo({ className }: { className?: string }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setAnimated(DEMO_SCORE);
      return;
    }
    let frame = 0;
    const frames = 36;
    const id = window.setInterval(() => {
      frame += 1;
      setAnimated(Math.round((DEMO_SCORE * frame) / frames));
      if (frame >= frames) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, []);

  return (
    <aside
      className={cn(
        "relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#1E293B]/90 p-5 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-6",
        className
      )}
      aria-label="Demo business health score"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#D4A373]/15 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
            Business Health Score
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#D4A373]">
            Demo · sample data
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
          {DEMO_STATUS}
        </span>
      </div>

      <p className="relative mt-4 text-5xl font-bold tabular-nums text-white sm:text-6xl">
        {animated}
        <span className="ml-1 text-lg font-medium text-[#94A3B8]">/100</span>
      </p>

      <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, animated))}%` }}
          role="progressbar"
          aria-valuenow={animated}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Demo business health score"
        />
      </div>

      <p className="relative mt-4 text-sm leading-relaxed text-[#94A3B8]">
        Strong lunch rush, one ingredient needs reorder soon. Ask Hilaac for the full story.
      </p>

      <dl className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
        {DEMO_BREAKDOWN.map((row) => (
          <div key={row.label}>
            <dt className="text-[11px] uppercase tracking-wide text-[#64748B]">{row.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-white">{row.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
