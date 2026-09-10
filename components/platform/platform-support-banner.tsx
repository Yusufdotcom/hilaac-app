import { Shield } from "lucide-react";

/**
 * Persistent Hilaac Platform support-session indicator.
 * Uses platform navy/gold — not warning amber — so it stays distinct from
 * tenant status badges and "Owner protected" chips.
 */
export function PlatformSupportBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-platform-support-banner="true"
      className="border-b-2 border-[#D4A373] bg-[#070B14] text-white shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D4A373]/20 text-[#F5D4A8]">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4A373]">
              Hilaac Platform
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-white sm:text-base">
              Support session — you are not this restaurant&apos;s owner
            </p>
            <p className="mt-0.5 text-xs text-slate-300">
              Tenant branding below is theirs. You are acting as Super Admin.
            </p>
          </div>
        </div>
        <a
          href="/platform/restaurants"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#D4A373] px-3.5 py-2 text-sm font-bold text-[#0F172A] shadow-sm transition-colors hover:bg-[#e4b888] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A373] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070B14]"
        >
          Back to Hilaac Platform
        </a>
      </div>
    </div>
  );
}
