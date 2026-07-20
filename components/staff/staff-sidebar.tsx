"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  CreditCard,
  LayoutGrid,
  LogOut,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SidebarBrandHeader } from "@/components/dashboard/sidebar-brand-header";
import {
  activeNavItemStyle,
  SIDEBAR_TEXT_COLOR,
  sidebarBrandStyles,
} from "@/lib/brand/restaurant-brand";
import type { UserRole } from "@/types/database";

const STAFF_NAV = [
  {
    key: "hub",
    label: "Staff Hub",
    icon: LayoutGrid,
    href: (slug: string) => `/staff/${slug}`,
    roles: ["owner", "manager", "kitchen", "waiter", "cashier"] as UserRole[],
  },
  {
    key: "kitchen",
    label: "Kitchen",
    icon: ChefHat,
    href: (slug: string) => `/staff/${slug}/kitchen`,
    roles: ["owner", "manager", "kitchen"] as UserRole[],
  },
  {
    key: "waiter",
    label: "Waiter",
    icon: UserRound,
    href: (slug: string) => `/staff/${slug}/waiter`,
    roles: ["owner", "manager", "waiter"] as UserRole[],
  },
  {
    key: "cashier",
    label: "Cashier",
    icon: CreditCard,
    href: (slug: string) => `/staff/${slug}/cashier`,
    roles: ["owner", "manager", "cashier"] as UserRole[],
  },
] as const;

export function StaffSidebar({
  slug,
  role,
  restaurantName,
  logoUrl,
  subscriptionTier,
  brandColor,
}: {
  slug: string;
  role: UserRole;
  restaurantName: string;
  logoUrl: string | null;
  subscriptionTier: string;
  brandColor?: string | null;
}) {
  const pathname = usePathname();
  const supabase = createClient();

  const navItems = STAFF_NAV.filter((item) => item.roles.includes(role));

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function isActive(href: string) {
    if (href === `/staff/${slug}`) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-white/10 text-white md:flex md:sticky md:top-0"
      style={sidebarBrandStyles(brandColor)}
    >
      <SidebarBrandHeader
        name={restaurantName}
        logoUrl={logoUrl}
        subscriptionTier={subscriptionTier}
        brandColor={brandColor}
      />

      <nav className="flex flex-1 flex-col justify-center gap-1 overflow-y-auto px-3 py-4">
        {navItems.map(({ label, icon: Icon, href }) => {
          const linkHref = href(slug);
          const active = isActive(linkHref);
          return (
            <Link
              key={linkHref}
              href={linkHref}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/10",
                active && "font-semibold"
              )}
              style={active ? activeNavItemStyle(brandColor) : { color: SIDEBAR_TEXT_COLOR }}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/10"
          style={{ color: SIDEBAR_TEXT_COLOR }}
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          Logout
        </button>
      </div>
    </aside>
  );
}
