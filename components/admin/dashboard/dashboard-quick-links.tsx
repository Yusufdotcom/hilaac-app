import Link from "next/link";
import { ArrowUpRight, ClipboardList, FileBarChart2, UtensilsCrossed, Users } from "lucide-react";

export function DashboardQuickLinks({
  slug,
  pendingOrders,
  menuItemCount,
}: {
  slug: string;
  pendingOrders: number;
  menuItemCount: number;
}) {
  const links = [
    {
      href: `/admin/${slug}/orders`,
      label: "Orders",
      detail: pendingOrders > 0 ? `${pendingOrders} pending` : "All clear",
      icon: ClipboardList,
    },
    {
      href: `/admin/${slug}/reports`,
      label: "Reports",
      detail: "Insights & exports",
      icon: FileBarChart2,
    },
    {
      href: `/admin/${slug}/menu`,
      label: "Menu",
      detail: `${menuItemCount} item${menuItemCount === 1 ? "" : "s"}`,
      icon: UtensilsCrossed,
    },
    {
      href: `/admin/${slug}/staff`,
      label: "Staff",
      detail: "Accounts & access",
      icon: Users,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {links.map(({ href, label, detail, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="admin-glass-hover group flex items-center gap-3 rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-4 py-3.5"
        >
          <span className="admin-brand-tint flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">{label}</p>
            <p className="truncate text-xs text-[var(--admin-muted,#64748B)]">{detail}</p>
          </div>
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-[var(--admin-muted,#94A3B8)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  );
}
