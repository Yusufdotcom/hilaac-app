"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { StaffSidebar } from "@/components/staff/staff-sidebar";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import type { Profile } from "@/types/database";

export function StaffLayoutShell({
  children,
  restaurantName,
  role,
  slug,
}: {
  children: React.ReactNode;
  restaurantName: string;
  role: Profile["role"];
  slug: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hilaac-dark bg-hilaac-navy px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <HilaacLogo
          href="/"
          variant="light"
          showWordmark
          src="/logo-icon.png"
          wordmarkClassName="text-white text-base"
          className="min-w-0"
        />
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      <div className="flex min-h-[calc(100vh-3.5rem)] md:min-h-screen">
        <StaffSidebar
          restaurantName={restaurantName}
          role={role}
          slug={slug}
          mobileOpen={mobileOpen}
          onMobileClose={closeMobileMenu}
        />
        <main className="app-light-surface relative z-0 flex min-w-0 flex-1 flex-col overflow-y-auto p-4 text-[#0F172A] sm:p-6 md:min-h-screen">
          <div className="flex-1">{children}</div>
          <PoweredByHilaac className="pb-2 pt-6" />
        </main>
      </div>
    </div>
  );
}
