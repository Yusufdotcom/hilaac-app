"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { AdminBrandProvider } from "@/components/admin/admin-brand-context";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { useSnapSidebar } from "@/lib/hooks/use-snap-sidebar";
import { cn } from "@/lib/utils";
import type { OwnerBranch } from "@/lib/admin/owner-branches";

export function AdminLayoutShell({
  children,
  restaurantName,
  logoUrl,
  subscriptionTier,
  brandColor,
  userName,
  currentSlug,
  branches = [],
}: {
  children: React.ReactNode;
  restaurantName: string;
  logoUrl: string | null;
  subscriptionTier: string;
  brandColor?: string | null;
  userName: string;
  currentSlug: string;
  branches?: OwnerBranch[];
}) {
  const pathname = usePathname();
  const { isExpanded, isCollapsed, isDragging, currentWidth, toggle, onPointerDown } = useSnapSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const offsetTransition = isDragging ? "none" : "300ms ease-out";
  const sidebarCssVars = {
    ["--admin-sidebar-width" as string]: `${currentWidth}px`,
  };

  return (
    <AdminBrandProvider brandColor={brandColor}>
      <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-[#F8FAFC]" style={sidebarCssVars}>
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 touch-manipulation bg-black/40 md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <AdminSidebar
          restaurantName={restaurantName}
          logoUrl={logoUrl}
          subscriptionTier={subscriptionTier}
          brandColor={brandColor}
          isExpanded={isExpanded}
          isCollapsed={isCollapsed}
          currentWidth={currentWidth}
          isDragging={isDragging}
          onToggle={toggle}
          onDragHandlePointerDown={onPointerDown}
          currentSlug={currentSlug}
          branches={branches}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        <header
          className={cn(
            "fixed top-0 z-30 flex h-14 items-center gap-2 border-b px-3 md:gap-3 md:px-6",
            "left-0 right-0 md:left-[var(--admin-sidebar-width)]",
            "border-[#334155]/60 bg-hilaac-navy md:border-[#E2E8F0] md:bg-white"
          )}
          style={{ transition: `left ${offsetTransition}` }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg text-[#D4A373] transition-colors hover:bg-white/10 md:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="admin-sidebar"
          >
            <Menu className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
          </button>

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

        <main
          className={cn(
            "app-light-surface relative z-0 flex min-h-screen w-full max-w-full flex-1 flex-col pt-14 text-[#0F172A]",
            "ml-0 overflow-x-hidden md:ml-[var(--admin-sidebar-width)]",
            mobileOpen ? "overflow-hidden" : "overflow-y-auto"
          )}
          style={{ transition: `margin-left ${offsetTransition}` }}
        >
          <div className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden p-4 sm:p-6">
            {children}
          </div>
          <PoweredByHilaac className="pb-4 pt-2 sm:pb-6" />
        </main>
      </div>
    </AdminBrandProvider>
  );
}
