"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, ChefHat, ClipboardList, LogOut, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getMobileSidebarStyle, useIsMobile } from "@/lib/hooks/use-slide-out-sidebar";
import type { Profile } from "@/types/database";

const STAFF_NAV = [
  {
    segment: "kitchen",
    label: "Kitchen",
    icon: ChefHat,
    roles: ["owner", "manager", "kitchen"] as Profile["role"][],
  },
  {
    segment: "waiter",
    label: "Waiter",
    icon: ClipboardList,
    roles: ["owner", "manager", "waiter"] as Profile["role"][],
  },
  {
    segment: "cashier",
    label: "Cashier",
    icon: Banknote,
    roles: ["owner", "manager", "cashier"] as Profile["role"][],
  },
] as const;

function navLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-200",
    active
      ? "bg-[#D4A373] text-[#0F172A]"
      : "text-hilaac-muted hover:bg-slate-800 hover:text-white"
  );
}

export function StaffSidebar({
  restaurantName,
  role,
  slug,
  onMobileClose,
  mobileTranslateX,
  mobileIsDragging = false,
  onSidebarTouchStart,
}: {
  restaurantName: string;
  role: Profile["role"];
  slug: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  mobileTranslateX?: number;
  mobileIsDragging?: boolean;
  onSidebarTouchStart?: (e: React.TouchEvent) => void;
}) {
  const pathname = usePathname();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const visibleNav = STAFF_NAV.filter((item) => item.roles.includes(role));

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
        "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-hilaac-dark bg-hilaac-navy text-white md:relative md:z-auto md:translate-x-0"
      )}
      style={
        isMobile && typeof mobileTranslateX === "number"
          ? getMobileSidebarStyle(mobileTranslateX, mobileIsDragging, 256)
          : undefined
      }
      onTouchStart={onSidebarTouchStart}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-hilaac-dark px-5">
        <HilaacLogo href="/" variant="light" src="/logo-icon.png" />
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

      <div className="shrink-0 border-b border-hilaac-dark px-5 py-4">
        <p className="truncate text-sm font-semibold text-white">{restaurantName}</p>
        <Badge className="mt-2 border-hilaac-gold/40 bg-hilaac-gold text-hilaac-navy hover:bg-hilaac-gold/90">
          {ROLE_LABELS[role] ?? role}
        </Badge>
      </div>

      {visibleNav.length > 0 && (
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {visibleNav.map((item) => {
            const href = `/staff/${slug}/${item.segment}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.segment}
                href={href}
                className={navLinkClass(active)}
                onClick={handleNavClick}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}

      {visibleNav.length === 0 && <div className="flex-1" />}

      <div className="shrink-0 border-t border-hilaac-dark p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-hilaac-muted transition-colors hover:bg-hilaac-dark hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </button>
      </div>
    </aside>
  );
}
