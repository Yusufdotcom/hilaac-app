import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createClient } from "@/lib/supabase/server";
import { PackagesView } from "@/components/admin/packages/packages-view";
import type { RamadanPackage } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PackagesPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const canUse = canUseFeature(restaurant.subscription_tier, "ramadan_packages");
  const activeSeason =
    restaurant.active_season === "ramadan" || restaurant.active_season === "eid"
      ? restaurant.active_season
      : null;

  let packages: RamadanPackage[] = [];
  if (canUse && activeSeason) {
    const supabase = createClient();
    const { data } = await supabase
      .from("ramadan_packages")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false });
    packages = (data as RamadanPackage[]) ?? [];
  }

  return (
    <PackagesView
      slug={params.slug}
      packages={packages}
      gated={!canUse}
      needsSeason={canUse && !activeSeason}
      activeSeason={activeSeason}
    />
  );
}
