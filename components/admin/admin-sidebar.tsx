"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Settings,
  Table,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { cn, daysUntil } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getBranchDisplayLabel, type OwnerBranch } from "@/lib/admin/owner-branches";
import { resolveBrandColor, subscriptionPlanLabel } from "@/lib/brand/restaurant-brand";
import type { SubscriptionTier } from "@/types/database";

const MAIN_NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: (s: string) => `/admin/${s}/dashboard` },
  { key: "menu", label: "Menu", icon: Utensils, href: (s: string) => `/admin/${s}/menu` },
  { key: "tables", label: "Tables", icon: Table, href: (s: string) => `/admin/${s}/tables` },
  { key: "orders", label: "Orders", icon: ListOrdered, href: (s: string) => `/admin/${s}/orders` },
  { key: "reports", label: "Reports", icon: BarChart3, href: (s: string) => `/admin/${s}/reports` },
] as const;

const MANAGE_NAV = [
  { key: "staff", label: "Staff", icon: Users, href: (s: string) => `/admin/${s}/staff` },
  { key: "settings", label: "Settings", icon: Settings, href: (s: string) => `/admin/${s}/settings` },
  { key: "billing", label: "Billing", icon: CreditCard, href: (s: string) => `/admin/${s}/billing` },
] as const;

function BranchCard({
  restaurantName,
  branchLabel,
  branches,
  currentSlug,
  brandColor,
}: {
  restaurantName: string;
  branchLabel: string;
  branches: OwnerBranch[];
  currentSlug: string;
  brandColor?: string | null;
}) {
  const router = useRouter();
  const accent = resolveBrandColor(brandColor);
  const initial = (restaurantName.trim()[0] || "R").toUpperCase();
  const canSwitch = branches.length > 1;

  return (
    <div className="relative mb-6">
      {canSwitch ? (
        <label className="block">
          <span className="sr-only">Switch branch</span>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-3 py-2.5 transition hover:border-slate-200">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} 14%, white)`,
                  color: accent,
                }}
              >
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--admin-text,#0F172A)]">
                  {restaurantName}
                </p>
                <p className="truncate text-xs text-[var(--admin-muted,#64748B)]">{branchLabel}</p>
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </div>
          <select
            className="absolute inset-0 cursor-pointer opacity-0"
            value={currentSlug}
            onChange={(e) => {
              if (e.target.value !== currentSlug) {
                router.push(`/admin/${e.target.value}/dashboard`);
              }
            }}
            aria-label="Switch branch"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.slug}>
                {getBranchDisplayLabel(b)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-3 py-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 14%, white)`,
              color: accent,
            }}
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--admin-text,#0F172A)]">
              {restaurantName}
            </p>
            <p className="truncate text-xs text-[var(--admin-muted,#64748B)]">{branchLabel}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  slug,
  subscriptionTier,
  subscriptionEndDate,
  onNavigate,
}: {
  slug: string;
  subscriptionTier: string;
  subscriptionEndDate?: string | null;
  onNavigate?: () => void;
}) {
  const daysLeft =
    subscriptionEndDate != null ? daysUntil(subscriptionEndDate) : null;
  const plan = subscriptionPlanLabel(subscriptionTier as SubscriptionTier);
  const accent = "var(--admin-brand, #9E2E2E)";

  return (
    <div className="mt-3 rounded-xl p-3.5 text-white" style={{ backgroundColor: accent }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{plan}</p>
        {daysLeft != null && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
            {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Expired"}
          </span>
        )}
      </div>
      <p className="mb-2.5 text-[11px] leading-snug text-white/75">
        {daysLeft != null && daysLeft > 0
          ? `Renews soon. Keep API payments & AI tools active.`
          : "Renew to keep API payments & AI tools active."}
      </p>
      <Link
        href={`/admin/${slug}/billing?renew=1`}
        onClick={() => onNavigate?.()}
        className="block w-full rounded-lg bg-white py-1.5 text-center text-xs font-semibold"
        style={{ color: "var(--admin-brand, #9E2E2E)" }}
      >
        Renew now
      </Link>
    </div>
  );
}

export function AdminSidebar({
  restaurantName,
  subscriptionTier,
  subscriptionEndDate,
  brandColor,
  currentSlug,
  branches = [],
  awaitingOrdersCount = 0,
  mobileOpen = false,
  onMobileClose,
}: {
  restaurantName: string;
  subscriptionTier: string;
  subscriptionEndDate?: string | null;
  brandColor?: string | null;
  currentSlug: string;
  branches?: OwnerBranch[];
  awaitingOrdersCount?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const slug = currentSlug;
  const supabase = createClient();
  const currentBranch = branches.find((b) => b.slug === slug);
  const branchLabel = currentBranch
    ? getBranchDisplayLabel(currentBranch)
    : "Main location";

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function isNavActive(href: string) {
    if (href === `/admin/${slug}/staff`) {
      return (
        pathname === href ||
        pathname.startsWith(`${href}/`) ||
        pathname.startsWith(`/admin/${slug}/staff-access`)
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function renderNav(
    items: typeof MAIN_NAV | typeof MANAGE_NAV,
    opts?: { showOrdersBadge?: boolean }
  ) {
    return items.map(({ key, href, label, icon: Icon }) => {
      const linkHref = href(slug);
      const active = isNavActive(linkHref);
      return (
        <Link
          key={key}
          href={linkHref}
          onClick={() => onMobileClose?.()}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            active
              ? "admin-nav-active"
              : "text-[var(--admin-muted,#64748B)] hover:bg-slate-50 dark:hover:bg-white/5"
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
          {opts?.showOrdersBadge && key === "orders" && awaitingOrdersCount > 0 && (
            <span
              className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: "var(--admin-brand, #9E2E2E)" }}
            >
              {awaitingOrdersCount > 99 ? "99+" : awaitingOrdersCount}
            </span>
          )}
        </Link>
      );
    });
  }

  const body = (
    <>
      <div className="mb-3 flex items-center justify-end md:hidden">
        <button
          type="button"
          onClick={() => onMobileClose?.()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] text-slate-400"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <BranchCard
        restaurantName={restaurantName}
        branchLabel={branchLabel}
        branches={branches}
        currentSlug={slug}
        brandColor={brandColor}
      />

      <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400">MAIN</p>
      <nav className="mb-6 space-y-1">{renderNav(MAIN_NAV, { showOrdersBadge: true })}</nav>

      <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400">MANAGE</p>
      <nav className="space-y-1">{renderNav(MANAGE_NAV)}</nav>

      <PlanCard
        slug={slug}
        subscriptionTier={subscriptionTier}
        subscriptionEndDate={subscriptionEndDate}
        onNavigate={onMobileClose}
      />

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--admin-muted)] transition-colors hover:bg-slate-50"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile glass drawer */}
      <aside
        id="admin-sidebar"
        className={cn(
          "admin-glass-panel pointer-events-auto fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto px-4 py-6 md:hidden",
          "transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "pointer-events-none -translate-x-full"
        )}
        aria-hidden={!mobileOpen}
      >
        {body}
      </aside>

      {/* Desktop fixed sidebar */}
      <aside className="pointer-events-auto fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-4 py-6 md:flex">
        {body}
      </aside>
    </>
  );
}
