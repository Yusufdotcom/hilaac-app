"use client";

import { cn } from "@/lib/utils";

export function MobileSidebarGrip({
  visible,
  onTouchStart,
}: {
  visible: boolean;
  onTouchStart: (e: React.TouchEvent) => void;
}) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-[45] flex w-6 touch-pan-y items-center md:hidden",
        "pointer-events-auto"
      )}
      onTouchStart={onTouchStart}
      aria-label="Swipe to open navigation"
      role="button"
    >
      <div className="ml-0.5 flex flex-col items-center gap-1 rounded-r-lg border border-l-0 border-[#D4A373]/25 bg-hilaac-navy/90 py-4 pl-1 pr-1.5 shadow-lg backdrop-blur-sm">
        <span className="h-8 w-0.5 rounded-full bg-[#D4A373]/50" aria-hidden="true" />
        <span className="flex flex-col gap-1" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="block h-1 w-1 rounded-full bg-[#D4A373]/70" />
          ))}
        </span>
      </div>
    </div>
  );
}

export function MobileSidebarBackdrop({
  visible,
  progress,
  onClose,
}: {
  visible: boolean;
  progress: number;
  onClose: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Close navigation"
      className="fixed inset-0 z-40 bg-black/40 md:hidden"
      style={{ opacity: Math.max(0, Math.min(1, progress)) }}
      onClick={onClose}
    />
  );
}
