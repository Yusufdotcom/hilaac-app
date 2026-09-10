import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { createClient } from "@/lib/supabase/server";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { fetchInventoryPageData } from "@/lib/inventory/fetch-inventory";
import { InventoryView } from "@/components/admin/inventory/inventory-view";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const canUseInventory = canUseFeature(restaurant.subscription_tier, "inventory");
  const supabase = createClient();

  const data = canUseInventory
    ? await fetchInventoryPageData(supabase, restaurant.id)
    : null;

  return (
    <InventoryView
      restaurantId={restaurant.id}
      data={data}
      gated={!canUseInventory}
    />
  );
}
