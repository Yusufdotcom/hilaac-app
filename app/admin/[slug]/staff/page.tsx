import { Suspense } from "react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { StaffHub } from "@/components/admin/staff/staff-hub";
import { getAppUrl } from "@/lib/app-url";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { fetchStaffPerformanceData } from "@/lib/staff/fetch-staff-performance";
import type { Profile, Waiter } from "@/types/database";

export default async function StaffPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await getRestaurantContext(params.slug);
  const supabase = createClient();
  const admin = createAdminClient();
  const canUseStaffPerformance = canUseFeature(
    restaurant.subscription_tier,
    "staff_performance"
  );

  const [{ data: waiters, error }, { data: staff, error: staffError }] = await Promise.all([
    supabase.from("waiters").select("*").eq("restaurant_id", restaurant.id).order("name"),
    admin
      .from("profiles")
      .select("id, full_name, role, phone, is_active, staff_pin_hash")
      .eq("restaurant_id", restaurant.id)
      .order("full_name", { ascending: true }),
  ]);

  if (error) {
    console.error("staff page waiters fetch:", error.message);
  }
  if (staffError) {
    console.error("staff page profiles fetch:", staffError.message);
  }

  const staffList = (
    (staff as (Pick<Profile, "id" | "full_name" | "role" | "phone" | "is_active"> & {
      staff_pin_hash?: string | null;
    })[]) ?? []
  ).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    role: s.role,
    phone: s.phone,
    is_active: s.is_active,
    has_pin: Boolean(s.staff_pin_hash),
  }));

  const performance = canUseStaffPerformance
    ? await fetchStaffPerformanceData(
        supabase,
        restaurant.id,
        staffList.map((s) => ({
          id: s.id,
          full_name: s.full_name,
          role: s.role,
          is_active: s.is_active,
        }))
      )
    : null;

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading staff…</div>}>
      <StaffHub
        restaurantId={restaurant.id}
        slug={restaurant.slug}
        appUrl={getAppUrl()}
        restaurantName={restaurant.name}
        staff={staffList}
        waiters={(waiters as Waiter[]) ?? []}
        performance={performance}
        canUseStaffPerformance={canUseStaffPerformance}
        actorRole={profile.role}
      />
    </Suspense>
  );
}
