import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { AdminOrdersBoard } from "@/components/admin/orders/admin-orders-board";
import { fetchManualPosMenuBundle } from "@/lib/order/fetch-manual-pos-menu";
import type { OrderWithItems } from "@/types/database";

export default async function AdminOrdersPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await getRestaurantContext(params.slug, [
    "owner",
    "manager",
  ]);
  const supabase = createClient();

  const [{ data: orders }, posMenu] = await Promise.all([
    supabase
      .from("orders")
      .select("*, table:table_id(*), order_items(*, menu_item:menu_item_id(*))")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(100),
    fetchManualPosMenuBundle(supabase, restaurant),
  ]);

  return (
    <AdminOrdersBoard
      restaurantId={restaurant.id}
      initialOrders={(orders as OrderWithItems[]) ?? []}
      actorRole={profile.role}
      posMenu={posMenu}
    />
  );
}
