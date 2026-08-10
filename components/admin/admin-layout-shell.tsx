"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminBrandProvider } from "@/components/admin/admin-brand-context";
import {
  AdminAppearanceProvider,
  useAdminAppearance,
} from "@/components/admin/admin-appearance-context";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { StaffIdleGuardian } from "@/components/auth/staff-idle-guardian";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { cn } from "@/lib/utils";
import type { OwnerBranch } from "@/lib/admin/owner-branches";
import type { UserRole } from "@/types/database";

function AdminShellChrome({
  children,
  restaurantName,
  subscriptionTier,
  subscriptionEndDate,
  brandColor,
  userName,
  userRole,
  avatarUrl,
  currentSlug,
  branches,
  awaitingOrdersCount,
}: {
  children: React.ReactNode;
  restaurantName: string;
  subscriptionTier: string;
  subscriptionEndDate?: string | null;
  brandColor?: string | null;
  userName: string;
  userRole: UserRole;
  avatarUrl?: string | null;
  currentSlug: string;
  branches: OwnerBranch[];
  awaitingOrdersCount: number;
}) {
  const pathname = usePathname();
  const { theme } = useAdminAppearance();
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

  return (
    <div
      className="admin-shell flex min-h-screen w-full max-w-[100vw] overflow-x-clip"
      data-admin-theme={theme}
    >
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 touch-manipulation bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop width reserve — sidebar is fixed; do not stretch with page height. */}
      <div className="hidden h-0 w-64 shrink-0 self-start md:block" aria-hidden="true" />

      <AdminSidebar
        restaurantName={restaurantName}
        subscriptionTier={subscriptionTier}
        subscriptionEndDate={subscriptionEndDate}
        brandColor={brandColor}
        currentSlug={currentSlug}
        branches={branches}
        awaitingOrdersCount={awaitingOrdersCount}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip",
          mobileOpen && "overflow-hidden md:overflow-x-clip"
        )}
      >
        <AdminTopBar
          slug={currentSlug}
          userName={userName}
          userRole={userRole}
          avatarUrl={avatarUrl}
          onOpenSidebar={() => setMobileOpen(true)}
        />

        <main className="admin-shell-main relative z-0 flex min-w-0 w-full flex-1 flex-col overflow-x-clip">
          <div className="mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
          <PoweredByHilaac className="pb-4 pt-2 sm:pb-6" />
        </main>
      </div>
    </div>
  );
}

export function AdminLayoutShell({
  children,
  restaurantName,
  subscriptionTier,
  subscriptionEndDate,
  brandColor,
  userName,
  userRole,
  avatarUrl,
  currentSlug,
  branches = [],
  awaitingOrdersCount = 0,
}: {
  children: React.ReactNode;
  restaurantName: string;
  logoUrl?: string | null;
  subscriptionTier: string;
  subscriptionEndDate?: string | null;
  brandColor?: string | null;
  userName: string;
  userRole: UserRole;
  avatarUrl?: string | null;
  currentSlug: string;
  branches?: OwnerBranch[];
  awaitingOrdersCount?: number;
}) {
  return (
    <AdminBrandProvider brandColor={brandColor}>
      <AdminAppearanceProvider>
        <StaffIdleGuardian role={userRole} />
        <AdminShellChrome
          restaurantName={restaurantName}
          subscriptionTier={subscriptionTier}
          subscriptionEndDate={subscriptionEndDate}
          brandColor={brandColor}
          userName={userName}
          userRole={userRole}
          avatarUrl={avatarUrl}
          currentSlug={currentSlug}
          branches={branches}
          awaitingOrdersCount={awaitingOrdersCount}
        >
          {children}
        </AdminShellChrome>
      </AdminAppearanceProvider>
    </AdminBrandProvider>
  );
}
