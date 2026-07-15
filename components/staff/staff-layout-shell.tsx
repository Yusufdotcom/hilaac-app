"use client";

import { useEffect } from "react";
import { StaffSidebar } from "@/components/staff/staff-sidebar";
import {
  MobileSidebarBackdrop,
  MobileSidebarGrip,
} from "@/components/layout/mobile-sidebar-grip";
import { useSlideOutSidebar } from "@/lib/hooks/use-slide-out-sidebar";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

const SIDEBAR_WIDTH = 256;

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
    function handleTouchStart(e: TouchEvent) {
      if (window.innerWidth >= 768) return;
      const touch = e.touches[0];
      tryOpenFromEdge(touch.clientX, touch.clientY);
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    return () => document.removeEventListener("touchstart", handleTouchStart);
  }, [tryOpenFromEdge]);

  const showMobileOverlay = mobileOpen || (isDragging && progress > 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <MobileSidebarGrip visible={progress < 0.01 && !isDragging} onTouchStart={onEdgeTouchStart} />

      <MobileSidebarBackdrop
        visible={showMobileOverlay}
        progress={progress}
        onClose={closeMobileSidebar}
      />

      <div className="flex min-h-screen">
        <StaffSidebar
          restaurantName={restaurantName}
          role={role}
          slug={slug}
          onMobileClose={closeMobileSidebar}
          mobileTranslateX={translateX}
          mobileIsDragging={isDragging}
          onSidebarTouchStart={onSidebarTouchStart}
        />
        <main
          className={cn(
            "app-light-surface relative z-0 flex min-w-0 flex-1 flex-col overflow-y-auto p-4 text-[#0F172A] transition-[filter,transform] duration-300 ease-out sm:p-6",
            showMobileOverlay &&
              "pointer-events-none scale-[0.985] backdrop-blur-sm md:pointer-events-auto md:scale-100 md:backdrop-blur-none"
          )}
        >
          <div className="flex-1">{children}</div>
          <PoweredByHilaac className="pb-2 pt-6" />
        </main>
      </div>
    </div>
  );
}
