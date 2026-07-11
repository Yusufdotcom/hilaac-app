import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { CashierBoard } from "@/components/staff/cashier/cashier-board";
import type { OrderWithItems } from "@/types/database";

export default async function CashierPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug, ["owner", "manager", "cashier"]);
  const supabase = createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, table:table_id(*), order_items(*, menu_item:menu_item_id(*))")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("cashier page orders fetch:", error.message);
  }

  return (
    <CashierBoard
      restaurantId={restaurant.id}
      restaurantName={restaurant.name}
      initialOrders={(orders as OrderWithItems[]) ?? []}
    />
  );
}
