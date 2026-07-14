"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  mobileOpen = false,
  onMobileClose,
}: {
  restaurantName: string;
  subscriptionTier: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const slug = pathname.split("/")[2];
  const supabase = createClient();

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
        "pointer-events-auto fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-hilaac-dark bg-hilaac-navy text-white transition-transform duration-300 ease-in-out md:z-[200] md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
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
          className={navLinkClass(pathname, `/admin/${slug}/dashboard`)}
          onClick={handleNavClick}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Dashboard</span>
        </Link>
        <Link
          href={`/admin/${slug}/menu`}
          className={navLinkClass(pathname, `/admin/${slug}/menu`)}
          onClick={handleNavClick}
        >
          <Utensils className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Menu</span>
        </Link>
        <Link
          href={`/admin/${slug}/tables`}
          className={navLinkClass(pathname, `/admin/${slug}/tables`)}
          onClick={handleNavClick}
        >
          <Table className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Tables</span>
        </Link>
        <Link
          href={`/admin/${slug}/orders`}
          className={navLinkClass(pathname, `/admin/${slug}/orders`)}
          onClick={handleNavClick}
        >
          <ListOrdered className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Orders</span>
        </Link>
        <Link
          href={`/admin/${slug}/staff-access`}
          className={navLinkClass(pathname, `/admin/${slug}/staff-access`)}
          onClick={handleNavClick}
        >
          <Users className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Staff Access</span>
        </Link>
        <Link
          href={`/admin/${slug}/staff`}
          className={navLinkClass(pathname, `/admin/${slug}/staff`)}
          onClick={handleNavClick}
        >
          <UserRound className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Waiters</span>
        </Link>
        <Link
          href={`/admin/${slug}/settings`}
          className={navLinkClass(pathname, `/admin/${slug}/settings`)}
          onClick={handleNavClick}
        >
          <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Settings</span>
        </Link>
        <Link
          href={`/admin/${slug}/billing`}
          className={navLinkClass(pathname, `/admin/${slug}/billing`)}
          onClick={handleNavClick}
        >
          <CreditCard className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Billing</span>
        </Link>
      </nav>

      <div className="relative z-10 shrink-0 border-t border-hilaac-dark p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-hilaac-muted transition-colors duration-200 hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
