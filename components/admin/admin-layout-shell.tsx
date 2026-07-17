"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { cn } from "@/lib/utils";
import type { OwnerBranch } from "@/lib/admin/owner-branches";

export function AdminLayoutShell({
  children,
  restaurantName,
  subscriptionTier,
  userName,
  currentSlug,
  branches = [],
}: {
  children: React.ReactNode;
  restaurantName: string;
  subscriptionTier: string;
  userName: string;
  currentSlug: string;
  branches?: OwnerBranch[];
}) {
  const [navOpen, setNavOpen] = useState(false);

  function closeNav() {
    setNavOpen(false);
  }

  function toggleNav() {
    setNavOpen((open) => !open);
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeNav}
        />
      )}

      <button
        type="button"
        onClick={toggleNav}
        aria-label={navOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={navOpen}
        className={cn(
          "fixed left-0 top-1/2 z-[60] flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-[#D4A373]/30 bg-hilaac-navy text-[#D4A373] shadow-lg transition-colors hover:bg-slate-800",
          navOpen && "translate-x-64"
        )}
      >
        {navOpen ? (
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <AdminSidebar
        restaurantName={restaurantName}
        subscriptionTier={subscriptionTier}
        isOpen={navOpen}
        onNavClick={closeNav}
        currentSlug={currentSlug}
        branches={branches}
      />

      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-[#334155]/60 bg-hilaac-navy px-4 md:border-[#E2E8F0] md:bg-white md:px-6">
        <HilaacLogo
          href="/"
          variant="light"
          showWordmark
          src="/logo-icon.png"
          wordmarkClassName="text-white text-base sm:text-lg md:text-inherit"
          className="min-w-0"
        />
        <div className="ml-auto">
          <AdminUserMenu userName={userName} />
        </div>
      </header>

      <main className="app-light-surface relative z-0 flex min-h-screen w-full flex-col overflow-y-auto pt-14 text-[#0F172A]">
        <div className="flex-1 p-4 sm:p-6 md:p-8">{children}</div>
        <PoweredByHilaac className="pb-6 pt-2" />
      </main>
    </div>
  );
}
