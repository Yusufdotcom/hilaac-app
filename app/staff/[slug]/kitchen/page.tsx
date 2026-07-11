import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { KitchenBoard } from "@/components/staff/kitchen/kitchen-board";
import type { OrderWithItems } from "@/types/database";

export default async function KitchenPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug, ["owner", "manager", "kitchen"]);
  const supabase = createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, table:table_id(*), order_items(*, menu_item:menu_item_id(*))")
    .eq("restaurant_id", restaurant.id)
    .in("status", ["new", "preparing", "ready"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("kitchen page orders fetch:", error.message);
  }

  return (
    <KitchenBoard
      restaurantId={restaurant.id}
      restaurantName={restaurant.name}
      initialOrders={(orders as OrderWithItems[]) ?? []}
    />
  );
}
