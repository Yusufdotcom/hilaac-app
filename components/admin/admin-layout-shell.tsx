"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";

export function AdminLayoutShell({
  children,
  restaurantName,
  subscriptionTier,
  userName,
}: {
  children: React.ReactNode;
  restaurantName: string;
  subscriptionTier: string;
  userName: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-[#334155]/60 bg-hilaac-navy px-4 md:left-64 md:border-[#E2E8F0] md:bg-white md:px-6">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <HilaacLogo
          href="/"
          variant="light"
          showWordmark
          src="/logo-icon.png"
          wordmarkClassName="text-white text-base sm:text-lg"
          className="min-w-0 md:hidden"
        />
        <div className="ml-auto">
          <AdminUserMenu userName={userName} />
        </div>
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <AdminSidebar
        restaurantName={restaurantName}
        subscriptionTier={subscriptionTier}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="app-light-surface relative z-0 flex min-h-screen min-w-0 flex-col overflow-y-auto pt-14 text-[#0F172A] md:ml-64">
        <div className="flex-1 p-4 sm:p-6 md:p-8">{children}</div>
        <PoweredByHilaac className="pb-6 pt-2" />
      </main>
    </div>
  );
}
