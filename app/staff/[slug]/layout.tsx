import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { StaffSidebar } from "@/components/staff/staff-sidebar";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";

export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const { restaurant, profile } = await getRestaurantContext(params.slug);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <StaffSidebar restaurantName={restaurant.name} role={profile.role} />
      <main className="app-light-surface relative z-0 flex min-w-0 flex-1 flex-col overflow-y-auto p-4 text-[#0F172A] sm:p-6">
        <div className="flex-1">{children}</div>
        <PoweredByHilaac className="pb-2 pt-6" />
      </main>
    </div>
  );
}
