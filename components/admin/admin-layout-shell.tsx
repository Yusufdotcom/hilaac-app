"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Menu } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import {
  MobileSidebarBackdrop,
  MobileSidebarGrip,
} from "@/components/layout/mobile-sidebar-grip";
import { useSlideOutSidebar } from "@/lib/hooks/use-slide-out-sidebar";
import { cn } from "@/lib/utils";
import type { OwnerBranch } from "@/lib/admin/owner-branches";

const SIDEBAR_STORAGE_KEY = "hilaac-admin-sidebar-open";
const SIDEBAR_WIDTH = 256;

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const {
    mobileOpen,
    translateX,
    isDragging,
    progress,
    close: closeMobileSidebar,
    onEdgeTouchStart,
    onSidebarTouchStart,
    tryOpenFromEdge,
  } = useSlideOutSidebar(SIDEBAR_WIDTH);

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

  useEffect(() => {
    function handleTouchStart(e: TouchEvent) {
      if (window.innerWidth >= 768) return;
      const touch = e.touches[0];
      tryOpenFromEdge(touch.clientX, touch.clientY);
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    return () => document.removeEventListener("touchstart", handleTouchStart);
  }, [tryOpenFromEdge]);

  function toggleSidebar() {
    setIsSidebarOpen((open) => !open);
  }

  const showMobileOverlay = mobileOpen || (isDragging && progress > 0);

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
          wordmarkClassName="text-white text-base sm:text-lg md:text-inherit"
          className="min-w-0 md:hidden"
        />
        <div className="ml-auto">
          <AdminUserMenu userName={userName} />
        </div>
      </header>

      <MobileSidebarGrip visible={progress < 0.01 && !isDragging} onTouchStart={onEdgeTouchStart} />

      <MobileSidebarBackdrop
        visible={showMobileOverlay}
        progress={progress}
        onClose={closeMobileSidebar}
      />

      <AdminSidebar
        restaurantName={restaurantName}
        subscriptionTier={subscriptionTier}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={toggleSidebar}
        onMobileClose={closeMobileSidebar}
        currentSlug={currentSlug}
        branches={branches}
        mobileTranslateX={translateX}
        mobileIsDragging={isDragging}
        onSidebarTouchStart={onSidebarTouchStart}
      />

      <main
        className={cn(
          "app-light-surface relative z-0 flex min-h-screen min-w-0 flex-col overflow-y-auto pt-14 text-[#0F172A] transition-[margin,filter,transform] duration-300 ease-out",
          isSidebarOpen ? "md:ml-64" : "md:ml-16",
          showMobileOverlay && "pointer-events-none scale-[0.985] backdrop-blur-sm md:pointer-events-auto md:scale-100 md:backdrop-blur-none"
        )}
      >
        <div className="flex-1 p-4 sm:p-6 md:p-8">{children}</div>
        <PoweredByHilaac className="pb-6 pt-2" />
      </main>
    </div>
  );
}
