import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createClient } from "@/lib/supabase/server";
import { EventsView, type BookingRow } from "@/components/admin/events/events-view";

export const dynamic = "force-dynamic";

export default async function EventsPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const canUse = canUseFeature(restaurant.subscription_tier, "event_hall_management");
  const canShowPl = canUseFeature(restaurant.subscription_tier, "event_pl_report");

  let bookings: BookingRow[] = [];
  if (canUse) {
    const supabase = createClient();
    const { data } = await supabase
      .from("event_bookings")
      .select(
        "id, event_type, event_name, contact_name, contact_phone, event_date, start_time, end_time, guest_count, status, total_price, deposit_paid, balance_due_date, estimated_cost, notes, space:space_id(id, name)"
      )
      .eq("restaurant_id", restaurant.id)
      .order("event_date", { ascending: false });
    bookings = (data as BookingRow[] | null) ?? [];
  }

  return (
    <EventsView
      slug={params.slug}
      bookings={bookings}
      gated={!canUse}
      canShowPl={canShowPl}
    />
  );
}
