import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createClient } from "@/lib/supabase/server";
import { EventsView } from "@/components/admin/events/events-view";

export const dynamic = "force-dynamic";

type BookingRow = {
  id: string;
  event_type: string;
  event_name: string | null;
  contact_name: string;
  contact_phone: string;
  event_date: string;
  guest_count: number | null;
  status: string;
  total_price: number | null;
  space?: { id: string; name: string } | null;
};

export default async function EventsPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const canUse = canUseFeature(restaurant.subscription_tier, "event_hall_management");

  let bookings: BookingRow[] = [];
  if (canUse) {
    const supabase = createClient();
    const { data } = await supabase
      .from("event_bookings")
      .select(
        "id, event_type, event_name, contact_name, contact_phone, event_date, guest_count, status, total_price, space:space_id(id, name)"
      )
      .eq("restaurant_id", restaurant.id)
      .order("event_date", { ascending: false });
    bookings = (data as BookingRow[] | null) ?? [];
  }

  return <EventsView slug={params.slug} bookings={bookings} gated={!canUse} />;
}