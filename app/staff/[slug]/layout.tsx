import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { StaffSidebar } from "@/components/staff/staff-sidebar";

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
      <main className="app-light-surface relative z-0 min-w-0 flex-1 overflow-y-auto p-4 text-[#0F172A] sm:p-6">
        {children}
      </main>
    </div>
  );
}
