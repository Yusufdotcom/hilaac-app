"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChefHat, CreditCard, LogOut, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SidebarBrandHeader } from "@/components/dashboard/sidebar-brand-header";
import {
  activeNavItemStyle,
  SIDEBAR_TEXT_COLOR,
  sidebarBrandStyles,
} from "@/lib/brand/restaurant-brand";
import type { UserRole } from "@/types/database";

/** Same role source as page gates: profiles.role from getRestaurantContext. */
const STAFF_NAV = [
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

function canReturnToAdmin(role: UserRole) {
  return role === "owner" || role === "manager";
}

export function StaffSidebar({
  slug,
  role,
  restaurantName,
  logoUrl,
  subscriptionTier,
  brandColor,
  open,
  onOpenChange,
}: {
  slug: string;
  role: UserRole;
  restaurantName: string;
  logoUrl: string | null;
  subscriptionTier: string;
  brandColor?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const supabase = createClient();

  const navItems = STAFF_NAV.filter((item) => item.roles.includes(role));
  const showBackToAdmin = canReturnToAdmin(role);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function close() {
    onOpenChange(false);
  }

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          aria-label="Close menu"
          onClick={close}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-white/10 text-white transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={sidebarBrandStyles(brandColor)}
        aria-hidden={!open}
      >
        <div className="flex items-start justify-between gap-2 pr-2">
          <div className="min-w-0 flex-1">
            <SidebarBrandHeader
              name={restaurantName}
              logoUrl={logoUrl}
              subscriptionTier={subscriptionTier}
              brandColor={brandColor}
            />
          </div>
          <button
            type="button"
            onClick={close}
            className="mt-4 mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            style={{ color: SIDEBAR_TEXT_COLOR }}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col justify-start gap-1 overflow-y-auto px-3 py-4">
          {navItems.length === 0 ? (
            <p className="px-4 text-sm" style={{ color: SIDEBAR_TEXT_COLOR }}>
              No stations available for your role.
            </p>
          ) : (
            navItems.map(({ label, icon: Icon, href }) => {
              const linkHref = href(slug);
              const active = isActive(linkHref);
              return (
                <Link
                  key={linkHref}
                  href={linkHref}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/10",
                    active && "font-semibold"
                  )}
                  style={active ? activeNavItemStyle(brandColor) : { color: SIDEBAR_TEXT_COLOR }}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {label}
                </Link>
              );
            })
          )}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
          {showBackToAdmin && (
            <Link
              href={`/admin/${slug}/dashboard`}
              onClick={close}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/10"
              style={{ color: SIDEBAR_TEXT_COLOR }}
            >
              <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
              Back to Admin
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/10"
            style={{ color: SIDEBAR_TEXT_COLOR }}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
