"use client";

import { useEffect, useRef, useState } from "react";
import { useOrderBrand } from "@/components/order/order-brand-context";
import {
  brandColorWithAlpha,
  customerPrimaryButtonStyleFromAccent,
} from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";

/**
 * Centered plate/tray cart trigger with live count badge.
 * bumpKey increments when an item is added — plays a short bounce (not queued).
 */
export function CartTrayFab({
  count,
  bumpKey,
  onOpen,
}: {
  count: number;
  bumpKey: number;
  onOpen: () => void;
}) {
  const { accent, customBrandingActive } = useOrderBrand();
  const style = customerPrimaryButtonStyleFromAccent(accent, customBrandingActive);
  const [pulse, setPulse] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const animatingRef = useRef(false);
  const lastBumpRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (bumpKey <= 0 || bumpKey === lastBumpRef.current) return;
    lastBumpRef.current = bumpKey;
    // Skip / don't queue if already animating or user prefers reduced motion.
    if (reducedMotion || animatingRef.current) return;

    animatingRef.current = true;
    setPulse(true);
    const t = window.setTimeout(() => {
      setPulse(false);
      animatingRef.current = false;
    }, 420);
    return () => window.clearTimeout(t);
  }, [bumpKey, reducedMotion]);

  if (count <= 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <style>{`
        @keyframes tray-catch {
          0% { transform: scale(1) translateY(0); }
          35% { transform: scale(1.18) translateY(-6px); }
          65% { transform: scale(0.96) translateY(1px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes tray-badge-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
      `}</style>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full",
          "shadow-lg transition-transform active:scale-95"
        )}
        style={{
          ...style,
          boxShadow: `0 10px 28px ${brandColorWithAlpha(accent, 0.35)}`,
          animation: pulse ? "tray-catch 0.42s cubic-bezier(0.34, 1.45, 0.64, 1)" : undefined,
        }}
        aria-label={`Open cart, ${count} items`}
      >
        {/* Tray / plate glyph */}
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <ellipse cx="12" cy="14.5" rx="8.5" ry="3.2" />
          <path d="M5 14.5V12c0-2.8 2.9-5 7-5s7 2.2 7 5v2.5" />
          <path d="M9 9.2c.6-1.4 1.7-2.2 3-2.2s2.4.8 3 2.2" />
        </svg>

        <span
          className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white ring-2 ring-white"
          style={{
            animation: pulse ? "tray-badge-pop 0.42s cubic-bezier(0.34, 1.45, 0.64, 1)" : undefined,
          }}
        >
          {count > 99 ? "99+" : count}
        </span>

        {pulse && (
          <span
            className="pointer-events-none absolute inset-0 rounded-full motion-safe:animate-ping"
            style={{ backgroundColor: brandColorWithAlpha(accent, 0.35) }}
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}
