import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { canUseAiFeatures } from "@/lib/constants";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { MenuManager } from "@/components/admin/menu/menu-manager";
import { fetchMenuIntelligence } from "@/lib/menu/fetch-menu-intelligence";
import type { MenuItem } from "@/types/database";

export default async function MenuPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const supabase = createClient();
  const canUseMenuIntelligence = canUseFeature(
    restaurant.subscription_tier,
    "menu_profitability"
  );

  const [{ data: categories }, { data: menuItems }, { data: addOns }] = await Promise.all([
    supabase.from("categories").select("*").eq("restaurant_id", restaurant.id).order("display_order"),
    supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("add_ons")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false }),
  ]);

  const items = (menuItems ?? []) as MenuItem[];
  const categoryIds = (categories ?? []).map((c) => c.id);
  const itemIds = items.map((m) => m.id);

  const [{ data: categoryAddOns }, { data: menuItemAddOns }, menuIntelligence] =
    await Promise.all([
      categoryIds.length
        ? supabase.from("category_add_ons").select("category_id, add_on_id").in("category_id", categoryIds)
        : Promise.resolve({ data: [] as { category_id: string; add_on_id: string }[] }),
      itemIds.length
        ? supabase.from("menu_item_add_ons").select("menu_item_id, add_on_id").in("menu_item_id", itemIds)
        : Promise.resolve({ data: [] as { menu_item_id: string; add_on_id: string }[] }),
      canUseMenuIntelligence
        ? fetchMenuIntelligence(supabase, restaurant.id, items)
        : Promise.resolve(null),
    ]);

  return (
    <MenuManager
      restaurantId={restaurant.id}
      categories={categories ?? []}
      menuItems={items}
      addOns={addOns ?? []}
      categoryAddOns={categoryAddOns ?? []}
      menuItemAddOns={menuItemAddOns ?? []}
      canUseAi={canUseAiFeatures(restaurant.subscription_tier)}
      canUseMenuIntelligence={canUseMenuIntelligence}
      menuIntelligence={menuIntelligence}
    />
  );
}
