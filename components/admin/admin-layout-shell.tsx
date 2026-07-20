"use client";

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
  const { isExpanded, isCollapsed, isDragging, currentWidth, toggle, onPointerDown } = useSnapSidebar();

  const marginTransition = isDragging ? "none" : "margin-left 300ms ease-out, left 300ms ease-out";

  return (
    <AdminBrandProvider brandColor={brandColor}>
    <div className="min-h-screen w-full bg-[#F8FAFC]">
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
      />

      <header
        className="fixed top-0 z-30 flex h-14 items-center gap-3 border-b border-[#334155]/60 bg-hilaac-navy px-4 md:border-[#E2E8F0] md:bg-white md:px-6"
        style={{
          left: currentWidth,
          right: 0,
          transition: marginTransition,
        }}
      >
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
        className={cn("app-light-surface relative z-0 flex min-h-screen flex-col overflow-y-auto pt-14 text-[#0F172A]")}
        style={{
          marginLeft: currentWidth,
          transition: marginTransition,
        }}
      >
        <div className="flex-1 p-4 sm:p-6 md:p-8">{children}</div>
        <PoweredByHilaac className="pb-6 pt-2" />
      </main>
    </div>
    </AdminBrandProvider>
  );
}
