"use client";

import { PlatformSupportBanner } from "@/components/platform/platform-support-banner";

/**
 * Visual probe: platform support banner in light + dark admin shells.
 * Visit /dev/platform-support-banner-probe
 */
export default function PlatformSupportBannerProbePage() {
  return (
    <div className="min-h-screen space-y-10 bg-slate-200 p-6">
      <section className="overflow-hidden rounded-2xl border border-slate-300 shadow-lg">
        <p className="bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Light admin shell context
        </p>
        <div className="admin-shell" data-admin-theme="light">
          <PlatformSupportBanner />
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">Dashboard</p>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Active
            </span>
          </div>
          <div className="bg-[#f5f6fa] p-6">
            <button
              type="button"
              className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900"
            >
              Owner protected
            </button>
            <p className="mt-4 text-sm text-slate-600">
              Tenant branding / content sits below — amber chips stay distinct from the navy/gold
              platform banner.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-700 shadow-lg">
        <p className="bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Dark admin shell context
        </p>
        <div className="admin-shell" data-admin-theme="dark">
          <PlatformSupportBanner />
          <div className="flex items-center justify-between border-b border-[#2a2f42] bg-[#1c2030] px-4 py-4">
            <p className="text-sm font-semibold text-slate-100">Dashboard</p>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-200">
              Active
            </span>
          </div>
          <div className="bg-[#14171f] p-6">
            <button
              type="button"
              className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200"
            >
              Owner protected
            </button>
            <p className="mt-4 text-sm text-slate-400">
              Same banner treatment in dark mode — gold CTA remains high-contrast on navy.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
