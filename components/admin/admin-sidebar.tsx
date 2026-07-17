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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { BranchSelector } from "@/components/admin/branch-selector";
import {
  ADMIN_SIDEBAR_COLLAPSED_WIDTH,
  ADMIN_SIDEBAR_EXPANDED_WIDTH,
} from "@/lib/hooks/use-snap-sidebar";
import type { OwnerBranch } from "@/lib/admin/owner-branches";

function navLinkClass(pathname: string, href: string) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return cn(
    "flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer transition-colors duration-200",
    active
      ? "bg-[#D4A373] text-[#0F172A]"
      : "text-hilaac-muted hover:bg-slate-800 hover:text-white"
  );
}

export function AdminSidebar({
  restaurantName,
  subscriptionTier,
  isExpanded,
  currentWidth,
  isDragging,
  onToggle,
  onDragHandlePointerDown,
  currentSlug,
  branches = [],
}: {
  restaurantName: string;
  subscriptionTier: string;
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

  const navItems = [
    { href: `/admin/${slug}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
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
      className="pointer-events-auto fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col overflow-hidden border-r border-hilaac-dark bg-hilaac-navy text-white"
      style={{
        width: currentWidth,
        transition: isDragging ? "none" : "width 300ms ease-out",
      }}
    >
      {showFullContent ? (
        <>
          <div className="flex h-16 shrink-0 items-center border-b border-hilaac-dark px-5">
            <HilaacLogo href="/" variant="light" src="/logo-icon.png" />
          </div>

          <BranchSelector branches={branches} currentSlug={slug} collapsed={false} />

          <div className="shrink-0 border-b border-hilaac-dark px-5 py-4">
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

          <nav className="relative z-10 flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-3">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={navLinkClass(pathname, href)} title={label}>
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="relative z-10 shrink-0 border-t border-hilaac-dark p-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-hilaac-muted transition-colors duration-200 hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
              Logout
            </button>
          </div>
        </>
      ) : (
        <div className="relative z-30 flex h-full flex-col items-center py-4">
          <button
            type="button"
            onClick={onToggle}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#D4A373] transition-colors hover:bg-slate-800"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Left-edge drag hit zone (does not cover the expand button) */}
      <div
        className="absolute inset-y-0 left-0 z-20 w-3 touch-none cursor-col-resize"
        onPointerDown={onDragHandlePointerDown}
        aria-hidden="true"
      />

      {/* Right-edge drag handle + click-to-collapse */}
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
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-[#D4A373]/30 bg-hilaac-navy text-[#D4A373] shadow-md transition-colors hover:bg-slate-800"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </aside>
  );
}
