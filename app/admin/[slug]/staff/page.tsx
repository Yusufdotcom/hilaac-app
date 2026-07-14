import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { WaiterManager } from "@/components/admin/staff/waiter-manager";
import type { Waiter } from "@/types/database";

export default async function StaffPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const supabase = createClient();

  const { data: waiters, error } = await supabase
    .from("waiters")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("name");

  if (error) {
    console.error("staff page waiters fetch:", error.message);
  }

  return (
    <WaiterManager restaurantId={restaurant.id} waiters={(waiters as Waiter[]) ?? []} />
  );
}
