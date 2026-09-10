import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManualPosMenuBundle } from "@/components/admin/orders/manual-pos-dialog";
import type {
  AddOn,
  Category,
  CategoryAddOn,
  MenuItem,
  MenuItemAddOn,
  Restaurant,
  RestaurantTable,
} from "@/types/database";

/** Shared menu/tables bundle for Manual POS (admin + staff boards). */
export async function fetchManualPosMenuBundle(
  supabase: SupabaseClient,
  restaurant: Pick<
    Restaurant,
    "id" | "dine_in_enabled" | "takeaway_enabled"
  >
): Promise<ManualPosMenuBundle> {
  const [
    { data: categories },
    { data: menuItems },
    { data: addOns },
    { data: tables },
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("display_order"),
    supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("name"),
    supabase.from("add_ons").select("*").eq("restaurant_id", restaurant.id).order("name"),
    supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("table_number"),
  ]);

  const cats = (categories ?? []) as Category[];
  const items = (menuItems ?? []) as MenuItem[];
  const categoryIds = cats.map((c) => c.id);
  const itemIds = items.map((m) => m.id);

  const [{ data: categoryAddOns }, { data: menuItemAddOns }] = await Promise.all([
    categoryIds.length
      ? supabase.from("category_add_ons").select("category_id, add_on_id").in("category_id", categoryIds)
      : Promise.resolve({ data: [] as CategoryAddOn[] }),
    itemIds.length
      ? supabase.from("menu_item_add_ons").select("menu_item_id, add_on_id").in("menu_item_id", itemIds)
      : Promise.resolve({ data: [] as MenuItemAddOn[] }),
  ]);

  return {
    restaurantId: restaurant.id,
    dineInEnabled: restaurant.dine_in_enabled !== false,
    takeawayEnabled: restaurant.takeaway_enabled !== false,
    categories: cats,
    menuItems: items,
    addOns: (addOns ?? []) as AddOn[],
    categoryAddOns: (categoryAddOns ?? []) as CategoryAddOn[],
    menuItemAddOns: (menuItemAddOns ?? []) as MenuItemAddOn[],
    tables: (tables ?? []) as RestaurantTable[],
  };
}
