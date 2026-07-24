import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { AdminOrdersBoard } from "@/components/admin/orders/admin-orders-board";
import type { OrderWithItems } from "@/types/database";

export default async function AdminOrdersPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const supabase = createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, table:table_id(*), order_items(*, menu_item:menu_item_id(*))")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AdminOrdersBoard
      restaurantId={restaurant.id}
      initialOrders={(orders as OrderWithItems[]) ?? []}
    />
  );
}
