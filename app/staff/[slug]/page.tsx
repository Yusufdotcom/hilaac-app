import Link from "next/link";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";

const DASHBOARDS = [
  {
    emoji: "🍳",
    title: "Kitchen Dashboard",
    description: "View tickets, mark orders preparing or ready.",
    href: (slug: string) => `/staff/${slug}/kitchen`,
  },
  {
    emoji: "📋",
    title: "Waiter Dashboard",
    description: "Track tables and deliver ready orders.",
    href: (slug: string) => `/staff/${slug}/waiter`,
  },
  {
    emoji: "💰",
    title: "Cashier Dashboard",
    description: "Review payments and order totals.",
    href: (slug: string) => `/staff/${slug}/cashier`,
  },
] as const;

export default async function StaffHubPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-4">
      <header className="text-center sm:text-left">
        <h1 className="text-3xl font-bold text-[#0F172A]">Staff Hub</h1>
        <p className="mt-2 text-[#64748B]">
          {restaurant.name} — open Kitchen, Waiter, or Cashier in one click.
        </p>
      </header>

      <div className="grid gap-4 sm:gap-6">
        {DASHBOARDS.map((dashboard) => (
          <Link
            key={dashboard.title}
            href={dashboard.href(params.slug)}
            className="group flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition-all hover:border-[#D4A373]/50 hover:shadow-md sm:p-8"
          >
            <span className="text-4xl" aria-hidden="true">
              {dashboard.emoji}
            </span>
            <span className="mt-4 text-xl font-bold text-[#0F172A] group-hover:text-[#0F172A]">
              {dashboard.title}
            </span>
            <span className="mt-1 text-sm text-[#64748B]">{dashboard.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
