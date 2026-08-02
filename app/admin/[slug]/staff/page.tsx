import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { WaiterManager } from "@/components/admin/staff/waiter-manager";
import { StaffAccountsManager } from "@/components/admin/staff/staff-accounts-manager";
import type { Profile, Waiter } from "@/types/database";

export default async function StaffPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const supabase = createClient();
  const admin = createAdminClient();

  const [{ data: waiters, error }, { data: staff, error: staffError }] = await Promise.all([
    supabase
      .from("waiters")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("name"),
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
    <div className="w-full space-y-8">
      <StaffAccountsManager
        restaurantId={restaurant.id}
        staff={(staff as Pick<Profile, "id" | "full_name" | "role" | "phone" | "is_active">[]) ?? []}
      />
      <WaiterManager restaurantId={restaurant.id} waiters={(waiters as Waiter[]) ?? []} />
    </div>
  );
}
