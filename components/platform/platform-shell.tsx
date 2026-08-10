"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/settings", label: "Payment settings", icon: Settings },
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
    <div className="flex min-h-screen bg-[#0F172A] text-slate-100">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#0B1220] md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold tracking-tight">Hilaac Platform</p>
              <p className="text-[11px] text-slate-400">Super Admin</p>
            </div>
          </div>
          {adminName && (
            <p className="mt-3 truncate text-xs text-slate-400">{adminName}</p>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/10 text-white"
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
          <CreditCard className="h-5 w-5 text-amber-400" aria-hidden="true" />
          <p className="text-sm font-bold">Hilaac Platform</p>
          <div className="ml-auto flex gap-2">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-lg px-2 py-1 text-xs",
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
