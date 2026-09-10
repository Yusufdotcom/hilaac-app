"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Moon,
  Package,
  Plane,
  Settings,
  Table,
  UserRound,
  Users,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { cn, daysUntil } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  getBranchDisplayLabel,
  getBranchLabel,
  getBranchLocation,
  type OwnerBranch,
} from "@/lib/admin/owner-branches";
import { resolveBrandColor, subscriptionPlanLabel } from "@/lib/brand/restaurant-brand";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/components/i18n/locale-provider";
import { NAV_LABEL_TO_KEY } from "@/lib/i18n/locales";
import type { SubscriptionTier, UserRole } from "@/types/database";

/**
 * Admin sidebar nav.
 *
 * Step 16 retail-readiness (schema only — do NOT build retail UI yet):
 * When restaurants.business_type = 'retail':
 * - "Menu" label → "Products"
 * - Hide Kitchen / Waiter dashboards (staff post-login)
 * - Reuse inventory table as-is
 * - Adapt Cashier for retail checkout
 * Gate: wait until ≥2 Galeyr restaurants actively use Steps 6–9.
 */
const MAIN_NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: (s: string) => `/admin/${s}/dashboard` },
  { key: "menu", label: "Menu", icon: Utensils, href: (s: string) => `/admin/${s}/menu` },
  { key: "tables", label: "Tables", icon: Table, href: (s: string) => `/admin/${s}/tables` },
  { key: "inventory", label: "Inventory", icon: Package, href: (s: string) => `/admin/${s}/inventory` },
  { key: "orders", label: "Orders", icon: ListOrdered, href: (s: string) => `/admin/${s}/orders` },
  { key: "reports", label: "Reports", icon: BarChart3, href: (s: string) => `/admin/${s}/reports` },
  { key: "alerts", label: "Alerts", icon: Bell, href: (s: string) => `/admin/${s}/alerts` },
] as const;

const MANAGE_NAV = [
  { key: "expenses", label: "Expenses", icon: Wallet, href: (s: string) => `/admin/${s}/expenses`, ownerOnly: true },
  { key: "customers", label: "Customers", icon: UserRound, href: (s: string) => `/admin/${s}/customers`, ownerOnly: false },
  { key: "staff", label: "Staff", icon: Users, href: (s: string) => `/admin/${s}/staff`, ownerOnly: false },
  { key: "settings", label: "Settings", icon: Settings, href: (s: string) => `/admin/${s}/settings`, ownerOnly: false },
  { key: "billing", label: "Billing", icon: CreditCard, href: (s: string) => `/admin/${s}/billing`, ownerOnly: true },
] as const;

function BranchCard({
  restaurantName,
  logoUrl,
  branchLabel,
  branches,
  currentSlug,
  brandColor,
}: {
  restaurantName: string;
  logoUrl?: string | null;
  branchLabel: string;
  branches: OwnerBranch[];
  currentSlug: string;
  brandColor?: string | null;
}) {
  const router = useRouter();
  const accent = resolveBrandColor(brandColor);
  const initial = (restaurantName.trim()[0] || "R").toUpperCase();
  const canSwitch = branches.length > 1;
  const [open, setOpen] = useState(false);

  const avatar = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote restaurant logo URL from storage
    <img
      src={logoUrl}
      alt=""
      className="h-8 w-8 shrink-0 rounded-lg object-cover"
    />
  ) : (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
      style={{
        backgroundColor: `color-mix(in srgb, ${accent} 14%, white)`,
        color: accent,
      }}
    >
      {initial}
    </span>
  );

  function branchStatus(b: OwnerBranch): { label: string; active: boolean } {
    const expired =
      b.subscription_status === "expired" ||
      (b.subscription_end_date != null && new Date(b.subscription_end_date) < new Date());
    return expired
      ? { label: "Expired", active: false }
      : { label: "Active", active: true };
  }

  const trigger = (
    <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-3 py-2.5 transition hover:border-[var(--admin-border)]">
      <div className="flex min-w-0 items-center gap-2">
        {avatar}
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold text-[var(--admin-text,#0F172A)]">
            {restaurantName}
          </p>
          <p className="truncate text-xs text-[var(--admin-muted,#64748B)]">{branchLabel}</p>
        </div>
      </div>
      {canSwitch ? (
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
      ) : null}
    </div>
  );

  if (!canSwitch) {
    return <div className="mb-6">{trigger}</div>;
  }

  return (
    <div className="relative z-[60] mb-6">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-brand)] focus-visible:ring-offset-2"
            aria-label="Switch branch"
          >
            {trigger}
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="p-1.5">
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-muted,#64748B)]">
            Locations
          </p>
          <ul className="max-h-[min(50vh,18rem)] overflow-y-auto">
            {branches.map((b) => {
              const selected = b.slug === currentSlug;
              const status = branchStatus(b);
              const location = getBranchLocation(b.address);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg px-2.5 py-2.5 text-left transition",
                      selected
                        ? "bg-[var(--admin-bg,#F1F5F9)] ring-1 ring-[var(--admin-brand,#9E2E2E)]"
                        : "hover:bg-[var(--admin-bg,#F8FAFC)]"
                    )}
                    onClick={() => {
                      setOpen(false);
                      if (b.slug !== currentSlug) {
                        router.push(`/admin/${b.slug}/dashboard`);
                      }
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--admin-text,#0F172A)]">
                        {getBranchLabel(b)}
                      </span>
                      {location ? (
                        <span className="mt-0.5 block truncate text-xs text-[var(--admin-muted,#64748B)]">
                          {location}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        status.active ? "admin-pill-emerald" : "admin-pill-amber"
                      )}
                    >
                      {status.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
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
  logoUrl,
  subscriptionTier,
  subscriptionEndDate,
  brandColor,
  currentSlug,
  branches = [],
  awaitingOrdersCount = 0,
  alertsCount = 0,
  mobileOpen = false,
  onMobileClose,
  userRole = "owner",
  activeSeason = null,
}: {
  restaurantName: string;
  logoUrl?: string | null;
  subscriptionTier: string;
  subscriptionEndDate?: string | null;
  brandColor?: string | null;
  currentSlug: string;
  branches?: OwnerBranch[];
  awaitingOrdersCount?: number;
  alertsCount?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  userRole?: UserRole;
  activeSeason?: "ramadan" | "eid" | null;
}) {
  const pathname = usePathname();
  const slug = currentSlug;
  const supabase = createClient();
  const { t } = useLocale();
  const currentBranch = branches.find((b) => b.slug === slug);
  const branchLabel = currentBranch
    ? getBranchDisplayLabel(currentBranch)
    : "Main location";

  const canPackages = canUseFeature(subscriptionTier, "ramadan_packages");
  const canEvents = canUseFeature(subscriptionTier, "event_hall_management");
  const packagesAvailable = canPackages && Boolean(activeSeason);
  const eventsAvailable = canEvents;

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
    opts?: { showOrdersBadge?: boolean; showAlertsBadge?: boolean }
  ) {
    const visible =
      items === MANAGE_NAV
        ? MANAGE_NAV.filter((item) => userRole === "owner" || !item.ownerOnly)
        : MAIN_NAV;
    return visible.map(({ key, href, label, icon: Icon }) => {
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
              : "text-[var(--admin-muted,#64748B)] hover:bg-[var(--admin-hover)]"
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="truncate">
            {NAV_LABEL_TO_KEY[label] ? t(NAV_LABEL_TO_KEY[label]!) : label}
          </span>
          {opts?.showOrdersBadge && key === "orders" && awaitingOrdersCount > 0 && (
            <span
              className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: "var(--admin-brand, #9E2E2E)" }}
            >
              {awaitingOrdersCount > 99 ? "99+" : awaitingOrdersCount}
            </span>
          )}
          {opts?.showAlertsBadge && key === "alerts" && alertsCount > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
              {alertsCount > 99 ? "99+" : alertsCount}
            </span>
          )}
        </Link>
      );
    });
  }

  function SaNavLink({
    href,
    label,
    icon: Icon,
    available,
  }: {
    href: string;
    label: string;
    icon: typeof Moon;
    available: boolean;
  }) {
    const active = isNavActive(href);
    return (
      <Link
        href={href}
        onClick={() => onMobileClose?.()}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "admin-nav-active"
            : available
              ? "text-[var(--admin-muted,#64748B)] hover:bg-[var(--admin-hover)]"
              : "text-[var(--admin-muted,#94A3B8)] opacity-70 hover:bg-[var(--admin-hover)]"
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
        {!available ? (
          <Plane className="ml-auto h-3.5 w-3.5 shrink-0 opacity-80" aria-label="Somali Airlines" />
        ) : null}
      </Link>
    );
  }

  const body = (
    <>
      <div className="mb-3 flex items-center justify-end md:hidden">
        <button
          type="button"
          onClick={() => onMobileClose?.()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] text-[var(--admin-muted)]"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <BranchCard
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        branchLabel={branchLabel}
        branches={branches}
        currentSlug={slug}
        brandColor={brandColor}
      />

      <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-[var(--admin-muted)]">MAIN</p>
      <nav className="mb-6 space-y-1">
        {renderNav(MAIN_NAV, { showOrdersBadge: true, showAlertsBadge: true })}
        <SaNavLink
          href={`/admin/${slug}/packages`}
          label="Packages"
          icon={Moon}
          available={packagesAvailable}
        />
        <SaNavLink
          href={`/admin/${slug}/events`}
          label="Events"
          icon={CalendarDays}
          available={eventsAvailable}
        />
      </nav>

      <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-[var(--admin-muted)]">MANAGE</p>
      <nav className="space-y-1">{renderNav(MANAGE_NAV)}</nav>

      {userRole === "owner" ? (
        <PlanCard
          slug={slug}
          subscriptionTier={subscriptionTier}
          subscriptionEndDate={subscriptionEndDate}
          onNavigate={onMobileClose}
        />
      ) : null}

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-bg)]"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          {t("nav.logout")}
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
