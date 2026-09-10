import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { PublicReserveClient } from "@/components/public/reserve-client";
import type { EventSpace } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PublicReservePage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, slug, subscription_tier, is_active")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!restaurant || restaurant.is_active === false) notFound();
  if (!canUseFeature(restaurant.subscription_tier, "event_hall_management")) notFound();

  const { data: spaces } = await admin
    .from("event_spaces")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <PublicReserveClient
      slug={params.slug}
      restaurantName={restaurant.name}
      spaces={(spaces as EventSpace[]) ?? []}
    />
  );
}
