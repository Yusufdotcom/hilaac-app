import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { PublicRamadanClient } from "@/components/public/ramadan-register-client";
import type { RamadanPackage } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PublicRamadanPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, slug, subscription_tier, active_season, is_active")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!restaurant || restaurant.is_active === false) notFound();
  if (!canUseFeature(restaurant.subscription_tier, "ramadan_packages")) notFound();
  if (!restaurant.active_season) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">{restaurant.name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Season packages are not open for registration right now.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: packages } = await admin
    .from("ramadan_packages")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .eq("season", restaurant.active_season)
    .eq("is_active", true)
    .lte("valid_from", today)
    .gte("valid_to", today)
    .order("price", { ascending: true });

  return (
    <PublicRamadanClient
      slug={params.slug}
      restaurantName={restaurant.name}
      packages={(packages as RamadanPackage[]) ?? []}
    />
  );
}
