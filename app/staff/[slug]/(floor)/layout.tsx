import { createClient } from "@/lib/supabase/server";
import { StaffLayoutShell } from "@/components/staff/staff-layout-shell";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { readStaffPinSession } from "@/lib/auth/staff-pin-server";

export const dynamic = "force-dynamic";

export default async function StaffFloorLayout({
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
  const pin = await readStaffPinSession();
  const isPinTablet = Boolean(pin && pin.slug === params.slug && (!user || pin.profileId === user.id));

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
      pinSession={isPinTablet}
      staffDisplayName={profile.full_name ?? pin?.fullName ?? null}
    >
      {children}
    </StaffLayoutShell>
  );
}
