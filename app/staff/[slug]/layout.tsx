import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StaffLayoutShell } from "@/components/staff/staff-layout-shell";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";

export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { restaurant, profile } = await getRestaurantContext(params.slug, [
    "owner",
    "manager",
    "kitchen",
    "waiter",
    "cashier",
  ]);

  return (
    <StaffLayoutShell
      slug={params.slug}
      role={profile.role}
      restaurantName={restaurant.name}
      logoUrl={restaurant.logo_url}
      subscriptionTier={restaurant.subscription_tier}
      brandColor={restaurant.brand_color}
    >
      {children}
    </StaffLayoutShell>
  );
}
