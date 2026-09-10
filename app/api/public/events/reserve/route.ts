import { NextRequest, NextResponse } from "next/server";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createAdminClient } from "@/lib/supabase/server";
import type { EventType } from "@/types/database";

export const dynamic = "force-dynamic";

const EVENT_TYPES: EventType[] = [
  "wedding",
  "graduation",
  "corporate",
  "birthday",
  "meeting",
  "other",
];

/**
 * POST /api/public/events/reserve
 * Public inquiry booking via service role.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug ?? "").trim();
  const contactName = String(body.contact_name ?? "").trim();
  const contactPhone = String(body.contact_phone ?? "").trim();
  const eventDate = String(body.event_date ?? "").trim();
  const eventType = EVENT_TYPES.includes(body.event_type) ? (body.event_type as EventType) : "other";

  if (!slug || !contactName || !contactPhone || !eventDate) {
    return NextResponse.json(
      { error: "slug, contact_name, contact_phone, and event_date are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, subscription_tier, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant || restaurant.is_active === false) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "event_hall_management")) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const spaceId =
    typeof body.space_id === "string" && body.space_id.trim() ? body.space_id.trim() : null;

  if (spaceId) {
    const { data: space } = await admin
      .from("event_spaces")
      .select("id")
      .eq("id", spaceId)
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
  }

  const { data: booking, error } = await admin
    .from("event_bookings")
    .insert({
      restaurant_id: restaurant.id,
      space_id: spaceId,
      event_type: eventType,
      event_name: typeof body.event_name === "string" ? body.event_name.trim() || null : null,
      contact_name: contactName,
      contact_phone: contactPhone,
      contact_organization:
        typeof body.contact_organization === "string"
          ? body.contact_organization.trim() || null
          : null,
      event_date: eventDate,
      start_time: body.start_time ? String(body.start_time) : null,
      end_time: body.end_time ? String(body.end_time) : null,
      guest_count:
        body.guest_count != null && body.guest_count !== "" ? Number(body.guest_count) : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      status: "inquiry",
      booking_source: "online_link",
    })
    .select("id, status, event_date")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, booking });
}
