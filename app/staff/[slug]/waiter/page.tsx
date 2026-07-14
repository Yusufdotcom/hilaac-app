import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { WaiterBoard } from "@/components/staff/waiter/waiter-board";
import type { OrderWithItems, RestaurantTable } from "@/types/database";

export default async function WaiterPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug, ["owner", "manager", "waiter"]);
  const supabase = createClient();

  const [{ data: tables, error: tablesError }, { data: orders, error: ordersError }, { data: waiters, error: waitersError }] =
    await Promise.all([
      supabase
        .from("tables")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("table_number"),
      supabase
        .from("orders")
        .select("*, table:table_id(*), order_items(*, menu_item:menu_item_id(*))")
        .eq("restaurant_id", restaurant.id)
        .in("status", ["new", "preparing", "ready"])
        .order("created_at", { ascending: true }),
      supabase
        .from("waiters")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("name"),
    ]);

  if (tablesError) console.error("waiter page tables fetch:", tablesError.message);
  if (ordersError) console.error("waiter page orders fetch:", ordersError.message);
  if (waitersError) console.error("waiter page waiters fetch:", waitersError.message);

  return (
    <WaiterBoard
      restaurantId={restaurant.id}
      restaurantName={restaurant.name}
      tables={(tables as RestaurantTable[]) ?? []}
      initialOrders={(orders as OrderWithItems[]) ?? []}
      waiters={waiters ?? []}
    />
  );
}
