"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminNotifications } from "@/components/admin/admin-notifications";
import { AdminThemeToggle } from "@/components/admin/admin-theme-toggle";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { getAdminPageMeta } from "@/lib/admin/admin-page-meta";
import type { UserRole } from "@/types/database";

export function AdminTopBar({
  slug,
  userName,
  userRole,
  avatarUrl,
  isPlatformAdmin = false,
  onOpenSidebar,
}: {
  slug: string;
  userName: string;
  userRole: UserRole;
  avatarUrl?: string | null;
  isPlatformAdmin?: boolean;
  onOpenSidebar: () => void;
}) {
  const pathname = usePathname();
  const meta = getAdminPageMeta(pathname);

  return (
    <header className="admin-glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-4 sm:gap-6 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--admin-border)] md:hidden"
          aria-label="Open menu"
          aria-controls="admin-sidebar"
        >
          <Menu className="h-[18px] w-[18px] text-[var(--admin-muted)]" />
        </button>
        <div className="min-w-0">
          <p className="mb-0.5 hidden text-xs text-[var(--admin-muted)] sm:block">{meta.crumb}</p>
          <h1 className="truncate text-lg font-bold text-[var(--admin-text)] sm:text-xl">
            {meta.title}
          </h1>
        </div>
      </div>

      <div className="hidden max-w-md flex-1 lg:block">
        <AdminSearch slug={slug} />
      </div>

      <AdminSearch slug={slug} compact className="lg:hidden" />

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <AdminThemeToggle />
        <AdminNotifications />
        <AdminUserMenu
          userName={userName}
          userRole={userRole}
          avatarUrl={avatarUrl}
          isPlatformAdmin={isPlatformAdmin}
        />
      </div>
    </header>
  );
}
