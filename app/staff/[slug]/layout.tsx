import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { StaffLayoutShell } from "@/components/staff/staff-layout-shell";

export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const { restaurant, profile } = await getRestaurantContext(params.slug);

  return (
    <StaffLayoutShell restaurantName={restaurant.name} role={profile.role} slug={params.slug}>
      {children}
    </StaffLayoutShell>
  );
}
