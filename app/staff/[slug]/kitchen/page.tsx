import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { KitchenBoard } from "@/components/staff/kitchen/kitchen-board";
import { filterKitchenOrders } from "@/lib/order/kitchen-visibility";
import type { OrderWithItems, MenuItem } from "@/types/database";

export default async function KitchenPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug, ["owner", "manager", "kitchen"]);
  const supabase = createClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ data: orders, error }, { data: deliveredOrders, count: deliveredCount, error: deliveredError }, { data: menuItems, error: menuError }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*, table:table_id(*), order_items(*, menu_item:menu_item_id(*))")
        .eq("restaurant_id", restaurant.id)
        .in("status", ["new", "preparing", "ready"])
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*, table:table_id(*), order_items(*, menu_item:menu_item_id(*))", { count: "exact" })
        .eq("restaurant_id", restaurant.id)
        .in("status", ["delivered", "completed"])
        .gte("updated_at", startOfDay.toISOString())
        .order("updated_at", { ascending: false })
        .limit(12),
      supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("name"),
    ]);

  if (error) {
    console.error("kitchen page orders fetch:", error.message);
  }
  if (deliveredError) {
    console.error("kitchen page delivered count fetch:", deliveredError.message);
  }
  if (menuError) {
    console.error("kitchen page menu items fetch:", menuError.message);
  }

  return (
    <KitchenBoard
      restaurantId={restaurant.id}
      restaurantName={restaurant.name}
      initialOrders={filterKitchenOrders((orders as OrderWithItems[]) ?? [])}
      initialDeliveredCount={deliveredCount ?? 0}
      initialDeliveredOrders={(deliveredOrders as OrderWithItems[]) ?? []}
      initialMenuItems={(menuItems as MenuItem[]) ?? []}
    />
  );
}
