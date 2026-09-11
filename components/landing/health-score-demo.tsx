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
 * Compact by default so the real dashboard screenshot stays primary.
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
        "relative w-full overflow-hidden rounded-xl border border-hilaac-gold/30 bg-hilaac-navy-mid/95 p-3.5 shadow-2xl shadow-black/50 backdrop-blur-md sm:p-4",
        className
      )}
      aria-label="Demo business health score"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-hilaac-gold/20 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="font-ui text-[10px] font-medium uppercase tracking-wider text-hilaac-gold-pale/70">
            Business Health Score
          </p>
          <p className="mt-0.5 font-brand text-[9px] font-semibold uppercase tracking-[0.16em] text-hilaac-gold">
            Demo · sample data
          </p>
        </div>
        <span className="rounded-full border border-hilaac-gold/40 bg-hilaac-gold/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-hilaac-gold-light">
          {DEMO_STATUS}
        </span>
      </div>

      <p className="relative mt-2 font-brand text-3xl font-extrabold tabular-nums tracking-tight text-hilaac-white sm:text-4xl">
        {animated}
        <span className="ml-1 text-sm font-medium text-hilaac-gold-pale/60">/100</span>
      </p>

      <div className="relative mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-hilaac-navy-light">
        <div
          className="h-full rounded-full bg-gradient-to-r from-hilaac-gold to-hilaac-gold-light transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, animated))}%` }}
          role="progressbar"
          aria-valuenow={animated}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Demo business health score"
        />
      </div>

      <dl className="relative mt-3 grid grid-cols-2 gap-2 border-t border-hilaac-gold/15 pt-2.5">
        {DEMO_BREAKDOWN.slice(0, 2).map((row) => (
          <div key={row.label}>
            <dt className="font-ui text-[9px] uppercase tracking-wide text-hilaac-gold-pale/50">
              {row.label}
            </dt>
            <dd className="mt-0.5 font-ui text-xs font-semibold text-hilaac-white">{row.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
