"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/platform/restaurants", label: "All Restaurants", icon: Building2 },
  { href: "/platform/renewals", label: "Pending Renewals", icon: CreditCard },
  { href: "/platform/settings", label: "Platform Settings", icon: Settings },
] as const;

export function PlatformShell({
  children,
  adminName,
}: {
  children: React.ReactNode;
  adminName?: string | null;
}) {
  const pathname = usePathname();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div
      className="platform-shell flex min-h-screen bg-[#0B1220] text-slate-100"
      data-platform-shell="true"
    >
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-[#070B14] md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
            Hilaac
          </p>
          <p className="mt-1 text-base font-bold tracking-tight text-white">Platform</p>
          <p className="mt-0.5 text-xs text-slate-400">Super Admin · all tenants</p>
          {adminName ? (
            <p className="mt-3 truncate text-xs text-slate-500">{adminName}</p>
          ) : null}
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Platform">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-amber-500/15 text-amber-100"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 md:hidden">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
              Hilaac
            </p>
            <p className="text-sm font-bold text-white">Platform</p>
          </div>
          <div className="ml-auto flex max-w-[60%] flex-wrap justify-end gap-1">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-lg px-2 py-1 text-[11px]",
                  pathname.startsWith(href) ? "bg-white/10 text-white" : "text-slate-400"
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
