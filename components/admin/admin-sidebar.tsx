"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  LayoutDashboard,
  Utensils,
  Table,
  ListOrdered,
  Settings,
  CreditCard,
  LogOut,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { BranchSelector } from "@/components/admin/branch-selector";
import { getMobileSidebarStyle, useIsMobile } from "@/lib/hooks/use-slide-out-sidebar";
import type { OwnerBranch } from "@/lib/admin/owner-branches";

function navLinkClass(pathname: string, href: string, collapsed: boolean) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return cn(
    "flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer transition-colors duration-200",
    collapsed && "md:justify-center md:px-0",
    active
      ? "bg-[#D4A373] text-[#0F172A]"
      : "text-hilaac-muted hover:bg-slate-800 hover:text-white"
  );
}

export function AdminSidebar({
  restaurantName,
  subscriptionTier,
  isSidebarOpen,
  onToggleSidebar,
  onMobileClose,
  currentSlug,
  branches = [],
  mobileTranslateX,
  mobileIsDragging = false,
  onSidebarTouchStart,
}: {
  restaurantName: string;
  subscriptionTier: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  currentSlug?: string;
  branches?: OwnerBranch[];
  mobileTranslateX?: number;
  mobileIsDragging?: boolean;
  onSidebarTouchStart?: (e: React.TouchEvent) => void;
}) {
  const pathname = usePathname();
  const slug = currentSlug ?? pathname.split("/")[2];
  const supabase = createClient();
  const isMobile = useIsMobile();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleNavClick() {
    onMobileClose?.();
  }

  return (
    <aside
      className={cn(
        "pointer-events-auto fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-hilaac-dark bg-hilaac-navy text-white md:relative md:z-[200] md:translate-x-0 md:transition-all md:duration-300 md:ease-in-out",
        isSidebarOpen ? "md:w-64" : "md:w-16"
      )}
      style={
        isMobile && typeof mobileTranslateX === "number"
          ? getMobileSidebarStyle(mobileTranslateX, mobileIsDragging, 256)
          : undefined
      }
      onTouchStart={onSidebarTouchStart}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-hilaac-dark px-3",
          isSidebarOpen ? "justify-between md:px-5" : "justify-between md:justify-center md:px-2"
        )}
      >
        <div className={cn("min-w-0", !isSidebarOpen && "md:hidden")}>
          <HilaacLogo href="/" variant="light" src="/logo-icon.png" />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-hilaac-muted transition-colors hover:bg-slate-800 hover:text-white md:flex"
            aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={isSidebarOpen}
          >
            <ChevronLeft
              className={cn("h-5 w-5 transition-transform duration-300", !isSidebarOpen && "rotate-180")}
              aria-hidden="true"
            />
          </button>
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-hilaac-muted transition-colors hover:bg-slate-800 hover:text-white md:hidden"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <BranchSelector
        branches={branches}
        currentSlug={slug}
        collapsed={!isSidebarOpen}
      />

      <div className={cn("shrink-0 border-b border-hilaac-dark px-5 py-4", !isSidebarOpen && "md:hidden")}>
        <p className="truncate text-sm font-semibold text-white">{restaurantName}</p>
        <Badge
          className={cn(
            "mt-2 capitalize",
            subscriptionTier === "pro"
              ? "border-hilaac-gold/40 bg-hilaac-gold text-hilaac-navy hover:bg-hilaac-gold/90"
              : "border-hilaac-muted/30 bg-hilaac-dark text-hilaac-muted"
          )}
        >
          {subscriptionTier} plan
        </Badge>
      </div>

      <nav className="relative z-10 flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <Link
          href={`/admin/${slug}/dashboard`}
          className={navLinkClass(pathname, `/admin/${slug}/dashboard`, !isSidebarOpen)}
          onClick={handleNavClick}
          title="Dashboard"
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(!isSidebarOpen && "md:sr-only")}>Dashboard</span>
        </Link>
        <Link
          href={`/admin/${slug}/menu`}
          className={navLinkClass(pathname, `/admin/${slug}/menu`, !isSidebarOpen)}
          onClick={handleNavClick}
          title="Menu"
        >
          <Utensils className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(!isSidebarOpen && "md:sr-only")}>Menu</span>
        </Link>
        <Link
          href={`/admin/${slug}/tables`}
          className={navLinkClass(pathname, `/admin/${slug}/tables`, !isSidebarOpen)}
          onClick={handleNavClick}
          title="Tables"
        >
          <Table className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(!isSidebarOpen && "md:sr-only")}>Tables</span>
        </Link>
        <Link
          href={`/admin/${slug}/orders`}
          className={navLinkClass(pathname, `/admin/${slug}/orders`, !isSidebarOpen)}
          onClick={handleNavClick}
          title="Orders"
        >
          <ListOrdered className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(!isSidebarOpen && "md:sr-only")}>Orders</span>
        </Link>
        <Link
          href={`/admin/${slug}/reports`}
          className={navLinkClass(pathname, `/admin/${slug}/reports`, !isSidebarOpen)}
          onClick={handleNavClick}
          title="Reports"
        >
          <BarChart3 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(!isSidebarOpen && "md:sr-only")}>Reports</span>
        </Link>
        <Link
          href={`/admin/${slug}/staff-access`}
          className={navLinkClass(pathname, `/admin/${slug}/staff-access`, !isSidebarOpen)}
          onClick={handleNavClick}
          title="Staff Access"
        >
          <Users className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(!isSidebarOpen && "md:sr-only")}>Staff Access</span>
        </Link>
        <Link
          href={`/admin/${slug}/staff`}
          className={navLinkClass(pathname, `/admin/${slug}/staff`, !isSidebarOpen)}
          onClick={handleNavClick}
          title="Waiters"
        >
          <UserRound className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(!isSidebarOpen && "md:sr-only")}>Waiters</span>
        </Link>
        <Link
          href={`/admin/${slug}/settings`}
          className={navLinkClass(pathname, `/admin/${slug}/settings`, !isSidebarOpen)}
          onClick={handleNavClick}
          title="Settings"
        >
          <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(!isSidebarOpen && "md:sr-only")}>Settings</span>
        </Link>
        <Link
          href={`/admin/${slug}/billing`}
          className={navLinkClass(pathname, `/admin/${slug}/billing`, !isSidebarOpen)}
          onClick={handleNavClick}
          title="Billing"
        >
          <CreditCard className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(!isSidebarOpen && "md:sr-only")}>Billing</span>
        </Link>
      </nav>

      <div className="relative z-10 shrink-0 border-t border-hilaac-dark p-3">
        <button
          type="button"
          onClick={handleLogout}
          title="Logout"
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-hilaac-muted transition-colors duration-200 hover:bg-slate-800 hover:text-white",
            !isSidebarOpen && "md:justify-center md:px-0"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(!isSidebarOpen && "md:sr-only")}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
