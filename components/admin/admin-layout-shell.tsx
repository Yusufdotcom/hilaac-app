"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Menu } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { cn } from "@/lib/utils";
import type { OwnerBranch } from "@/lib/admin/owner-branches";

const SIDEBAR_STORAGE_KEY = "hilaac-admin-sidebar-open";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setIsSidebarOpen(stored === "true");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarOpen));
  }, [isSidebarOpen, hydrated]);

  function toggleSidebar() {
    setIsSidebarOpen((open) => !open);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-[#334155]/60 bg-hilaac-navy px-4 transition-[left] duration-300 ease-in-out md:border-[#E2E8F0] md:bg-white md:px-6",
          isSidebarOpen ? "md:left-64" : "md:left-16"
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] md:flex"
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={isSidebarOpen}
        >
          {isSidebarOpen ? (
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
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
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={toggleSidebar}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        currentSlug={currentSlug}
        branches={branches}
      />

      <main
        className={cn(
          "app-light-surface relative z-0 flex min-h-screen min-w-0 flex-col overflow-y-auto pt-14 text-[#0F172A] transition-[margin] duration-300 ease-in-out",
          isSidebarOpen ? "md:ml-64" : "md:ml-16"
        )}
      >
        <div className="flex-1 p-4 sm:p-6 md:p-8">{children}</div>
        <PoweredByHilaac className="pb-6 pt-2" />
      </main>
    </div>
  );
}
