"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
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
import { BranchSelector } from "@/components/admin/branch-selector";
import { SidebarBrandHeader } from "@/components/dashboard/sidebar-brand-header";
import {
  ADMIN_SIDEBAR_COLLAPSED_WIDTH,
  ADMIN_SIDEBAR_EXPANDED_WIDTH,
} from "@/lib/hooks/use-snap-sidebar";
import {
  activeNavItemStyle,
  SIDEBAR_TEXT_COLOR,
  sidebarBrandStyles,
} from "@/lib/brand/restaurant-brand";
import type { OwnerBranch } from "@/lib/admin/owner-branches";

const NAV_DEFS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: (s: string) => `/admin/${s}/dashboard` },
  { key: "menu", label: "Menu", icon: Utensils, href: (s: string) => `/admin/${s}/menu` },
  { key: "tables", label: "Tables", icon: Table, href: (s: string) => `/admin/${s}/tables` },
  { key: "orders", label: "Orders", icon: ListOrdered, href: (s: string) => `/admin/${s}/orders` },
  { key: "reports", label: "Reports", icon: BarChart3, href: (s: string) => `/admin/${s}/reports` },
  { key: "staff-access", label: "Staff Access", icon: Users, href: (s: string) => `/admin/${s}/staff-access` },
  { key: "waiters", label: "Waiters", icon: UserRound, href: (s: string) => `/admin/${s}/staff` },
  { key: "settings", label: "Settings", icon: Settings, href: (s: string) => `/admin/${s}/settings` },
  { key: "billing", label: "Billing", icon: CreditCard, href: (s: string) => `/admin/${s}/billing` },
] as const;

function SidebarFullContent({
  restaurantName,
  logoUrl,
  subscriptionTier,
  brandColor,
  slug,
  branches,
  showMobileClose,
  onMobileClose,
  onLogout,
  isNavActive,
}: {
  restaurantName: string;
  logoUrl: string | null;
  subscriptionTier: string;
  brandColor?: string | null;
  slug: string;
  branches: OwnerBranch[];
  showMobileClose?: boolean;
  onMobileClose?: () => void;
  onLogout: () => void;
  isNavActive: (href: string) => boolean;
}) {
  function navLinkClass(href: string) {
    const active = isNavActive(href);
    return cn(
      "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200",
      active ? "font-semibold" : "hover:bg-white/10"
    );
  }

  function navLinkStyle(href: string): React.CSSProperties | undefined {
    const active = isNavActive(href);
    if (!active) return { color: SIDEBAR_TEXT_COLOR };
    return activeNavItemStyle(brandColor);
  }

  return (
    <>
      <div className="flex items-start justify-between gap-1 pr-1">
        <div className="min-w-0 flex-1">
          <SidebarBrandHeader
            name={restaurantName}
            logoUrl={logoUrl}
            subscriptionTier={subscriptionTier}
            brandColor={brandColor}
          />
        </div>
        {showMobileClose && (
          <button
            type="button"
            onClick={() => onMobileClose?.()}
            className="mt-4 mr-2 flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            style={{ color: SIDEBAR_TEXT_COLOR }}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <BranchSelector
        branches={branches}
        currentSlug={slug}
        collapsed={false}
        brandColor={brandColor}
      />

      <nav className="relative z-10 flex min-h-0 flex-1 flex-col justify-start gap-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4">
        {NAV_DEFS.map(({ key, href, label, icon: Icon }) => {
          const linkHref = href(slug);
          return (
            <Link
              key={key}
              href={linkHref}
              className={navLinkClass(linkHref)}
              style={navLinkStyle(linkHref)}
              title={label}
              onClick={() => onMobileClose?.()}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative z-10 shrink-0 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full cursor-pointer touch-manipulation items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 hover:bg-white/10"
          style={{ color: SIDEBAR_TEXT_COLOR }}
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          Logout
        </button>
      </div>
    </>
  );
}

export function AdminSidebar({
  restaurantName,
  logoUrl,
  subscriptionTier,
  brandColor,
  isExpanded,
  currentWidth,
  isDragging,
  onToggle,
  onDragHandlePointerDown,
  currentSlug,
  branches = [],
  mobileOpen = false,
  onMobileClose,
}: {
  restaurantName: string;
  logoUrl: string | null;
  subscriptionTier: string;
  brandColor?: string | null;
  isExpanded: boolean;
  isCollapsed: boolean;
  currentWidth: number;
  isDragging: boolean;
  onToggle: () => void;
  onDragHandlePointerDown: (e: React.PointerEvent) => void;
  currentSlug?: string;
  branches?: OwnerBranch[];
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const slug = currentSlug ?? pathname.split("/")[2];
  const supabase = createClient();

  const snapMidpoint = (ADMIN_SIDEBAR_EXPANDED_WIDTH + ADMIN_SIDEBAR_COLLAPSED_WIDTH) / 2;
  const showFullContent = isDragging ? currentWidth > snapMidpoint : isExpanded;

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function isNavActive(href: string) {
    if (href === `/staff/${slug}`) {
      return pathname === href || pathname.startsWith(`/staff/${slug}/`);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const sharedFullProps = {
    restaurantName,
    logoUrl,
    subscriptionTier,
    brandColor,
    slug,
    branches,
    onLogout: handleLogout,
    isNavActive,
  };

  return (
    <>
      {/* Mobile drawer — off-canvas until opened */}
      <aside
        id="admin-sidebar"
        className={cn(
          "pointer-events-auto fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col overflow-hidden border-r border-white/10 text-white md:hidden",
          "transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
        style={sidebarBrandStyles(brandColor)}
        aria-hidden={!mobileOpen}
      >
        <SidebarFullContent
          {...sharedFullProps}
          showMobileClose
          onMobileClose={onMobileClose}
        />
      </aside>

      {/* Desktop snap sidebar */}
      <aside
        className="pointer-events-auto fixed inset-y-0 left-0 z-50 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-white/10 text-white md:flex"
        style={{
          ...sidebarBrandStyles(brandColor),
          width: currentWidth,
          transition: isDragging ? "none" : "width 300ms ease-out",
        }}
      >
        {showFullContent ? (
          <SidebarFullContent {...sharedFullProps} />
        ) : (
          <div className="relative z-30 flex h-full flex-col items-center py-3">
            <button
              type="button"
              onClick={onToggle}
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
              style={{ color: SIDEBAR_TEXT_COLOR }}
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>

            <nav className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
              {NAV_DEFS.map(({ key, href, label, icon: Icon }) => {
                const linkHref = href(slug);
                const active = isNavActive(linkHref);
                return (
                  <Link
                    key={key}
                    href={linkHref}
                    className={cn(
                      "flex items-center justify-center rounded-lg px-0 py-2.5 text-sm font-medium transition-colors duration-200",
                      active ? "font-semibold" : "hover:bg-white/10"
                    )}
                    style={
                      active ? activeNavItemStyle(brandColor) : { color: SIDEBAR_TEXT_COLOR }
                    }
                    title={label}
                    aria-label={label}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
              style={{ color: SIDEBAR_TEXT_COLOR }}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}

        <div
          className="absolute inset-y-0 left-0 z-20 w-3 touch-none cursor-col-resize"
          onPointerDown={onDragHandlePointerDown}
          aria-hidden="true"
        />

        {showFullContent && (
          <div
            className="absolute inset-y-0 right-0 z-30 flex w-5 touch-none cursor-col-resize items-center justify-center"
            onPointerDown={onDragHandlePointerDown}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/20 shadow-md transition-colors hover:bg-white/10"
              style={{ color: SIDEBAR_TEXT_COLOR }}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
