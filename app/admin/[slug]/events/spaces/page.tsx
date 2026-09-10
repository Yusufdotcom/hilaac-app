import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createClient } from "@/lib/supabase/server";
import { EventSpacesView } from "@/components/admin/events/event-spaces-view";
import type { EventSpace } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EventSpacesPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const canUse = canUseFeature(restaurant.subscription_tier, "event_hall_management");

  let spaces: EventSpace[] = [];
  if (canUse) {
    const supabase = createClient();
    const { data } = await supabase
      .from("event_spaces")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false });
    spaces = (data as EventSpace[]) ?? [];
  }

  return <EventSpacesView slug={params.slug} spaces={spaces} gated={!canUse} />;
}
