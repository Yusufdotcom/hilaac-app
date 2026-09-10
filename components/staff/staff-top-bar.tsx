"use client";

import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

const STAFF_TITLES: Record<string, string> = {
  kitchen: "Kitchen",
  waiter: "Waiter",
  cashier: "Cashier",
};

export function StaffTopBar({
  role,
  restaurantName,
  onOpenSidebar,
  pinSession = false,
  staffDisplayName = null,
  slug,
}: {
  role: UserRole;
  restaurantName: string;
  onOpenSidebar: () => void;
  pinSession?: boolean;
  staffDisplayName?: string | null;
  slug?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const segment = pathname.split("/").filter(Boolean)[2] ?? "";
  const title = STAFF_TITLES[segment] ?? "Staff";
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  async function endPinSession() {
    await fetch("/api/staff/pin/logout", { method: "POST" });
    router.replace(`/staff/${slug ?? ""}/pin`);
    router.refresh();
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--admin-border,#E2E8F0)]",
        "bg-white/70 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 sm:px-6"
      )}
      style={{
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        backdropFilter: "blur(20px) saturate(160%)",
      }}
    >
      <button
        type="button"
        onClick={onOpenSidebar}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#0F172A] shadow-sm"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <p className="truncate text-xs text-[#64748B]">
          {restaurantName} · {staffDisplayName || roleLabel}
          {pinSession ? " · PIN" : ""}
        </p>
        <h1 className="truncate text-lg font-bold text-[#0F172A]">{title}</h1>
      </div>
      {pinSession && slug ? (
        <button
          type="button"
          onClick={() => void endPinSession()}
          className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          Lock
        </button>
      ) : (
        <span
          className="ml-auto hidden h-2.5 w-2.5 shrink-0 rounded-full sm:block"
          style={{ backgroundColor: "var(--brand-accent, #9E2E2E)" }}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
