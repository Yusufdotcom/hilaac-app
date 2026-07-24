"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LayoutGrid,
  Utensils,
  Table,
  ListOrdered,
  Settings,
  CreditCard,
  LogOut,
  Users,
  UserRound,
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

  function navLinkClass(href: string, collapsed = false) {
    const active = isNavActive(href);
    return cn(
      "flex items-center rounded-lg text-sm font-medium transition-colors duration-200",
      collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-4 py-2.5",
      active ? "font-semibold" : "hover:bg-white/10"
    );
  }

  function navLinkStyle(href: string): React.CSSProperties | undefined {
    const active = isNavActive(href);
    if (!active) return { color: SIDEBAR_TEXT_COLOR };
    return activeNavItemStyle(brandColor);
  }

  const navItems = [
    { href: `/admin/${slug}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/staff/${slug}`, label: "Staff Hub", icon: LayoutGrid },
    { href: `/admin/${slug}/menu`, label: "Menu", icon: Utensils },
    { href: `/admin/${slug}/tables`, label: "Tables", icon: Table },
    { href: `/admin/${slug}/orders`, label: "Orders", icon: ListOrdered },
    { href: `/admin/${slug}/reports`, label: "Reports", icon: BarChart3 },
    { href: `/admin/${slug}/staff-access`, label: "Staff Access", icon: Users },
    { href: `/admin/${slug}/staff`, label: "Waiters", icon: UserRound },
    { href: `/admin/${slug}/settings`, label: "Settings", icon: Settings },
    { href: `/admin/${slug}/billing`, label: "Billing", icon: CreditCard },
  ] as const;

  return (
    <aside
      className="pointer-events-auto fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col overflow-hidden border-r border-white/10 text-white"
      style={{
        ...sidebarBrandStyles(brandColor),
        width: currentWidth,
        transition: isDragging ? "none" : "width 300ms ease-out",
      }}
    >
      {showFullContent ? (
        <>
          <SidebarBrandHeader
            name={restaurantName}
            logoUrl={logoUrl}
            subscriptionTier={subscriptionTier}
            brandColor={brandColor}
          />

          <BranchSelector
            branches={branches}
            currentSlug={slug}
            collapsed={false}
            brandColor={brandColor}
          />

          <nav className="relative z-10 flex min-h-0 flex-1 flex-col justify-start gap-1 overflow-y-auto overflow-x-hidden px-3 py-4">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={navLinkClass(href)}
                style={navLinkStyle(href)}
                title={label}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="relative z-10 shrink-0 border-t border-white/10 p-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 hover:bg-white/10"
              style={{ color: SIDEBAR_TEXT_COLOR }}
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
              Logout
            </button>
          </div>
        </>
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
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={navLinkClass(href, true)}
                style={navLinkStyle(href)}
                title={label}
                aria-label={label}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              </Link>
            ))}
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
  );
}
