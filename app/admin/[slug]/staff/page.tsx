import { Suspense } from "react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { StaffHub } from "@/components/admin/staff/staff-hub";
import { getAppUrl } from "@/lib/app-url";
import type { Profile, Waiter } from "@/types/database";

export default async function StaffPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const supabase = createClient();
  const admin = createAdminClient();

  const [{ data: waiters, error }, { data: staff, error: staffError }] = await Promise.all([
    supabase.from("waiters").select("*").eq("restaurant_id", restaurant.id).order("name"),
    admin
      .from("profiles")
      .select("id, full_name, role, phone, is_active")
      .eq("restaurant_id", restaurant.id)
      .order("full_name", { ascending: true }),
  ]);

  if (error) {
    console.error("staff page waiters fetch:", error.message);
  }
  if (staffError) {
    console.error("staff page profiles fetch:", staffError.message);
  }

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading staff…</div>}>
      <StaffHub
        restaurantId={restaurant.id}
        slug={restaurant.slug}
        appUrl={getAppUrl()}
        restaurantName={restaurant.name}
        staff={
          (staff as Pick<Profile, "id" | "full_name" | "role" | "phone" | "is_active">[]) ?? []
        }
        waiters={(waiters as Waiter[]) ?? []}
      />
    </Suspense>
  );
}
