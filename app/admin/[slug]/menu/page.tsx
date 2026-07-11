import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { canUseAiFeatures } from "@/lib/constants";
import { MenuManager } from "@/components/admin/menu/menu-manager";

export default async function MenuPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const supabase = createClient();

  const [{ data: categories }, { data: menuItems }, { data: addOns }] = await Promise.all([
    supabase.from("categories").select("*").eq("restaurant_id", restaurant.id).order("display_order"),
    supabase.from("menu_items").select("*").eq("restaurant_id", restaurant.id).order("created_at", { ascending: false }),
    supabase.from("add_ons").select("*").eq("restaurant_id", restaurant.id).order("created_at", { ascending: false }),
  ]);

  return (
    <MenuManager
      restaurantId={restaurant.id}
      categories={categories ?? []}
      menuItems={menuItems ?? []}
      addOns={addOns ?? []}
      canUseAi={canUseAiFeatures(restaurant.subscription_tier)}
    />
  );
}
