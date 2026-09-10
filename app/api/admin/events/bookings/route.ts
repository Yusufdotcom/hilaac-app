import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { EventBooking, EventType } from "@/types/database";

export const dynamic = "force-dynamic";

const EVENT_TYPES: EventType[] = [
  "wedding",
  "graduation",
  "corporate",
  "birthday",
  "meeting",
  "other",
];

async function loadRestaurant(restaurantId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurants")
    .select("id, subscription_tier")
    .eq("id", restaurantId)
    .maybeSingle();
  return data;
}

/**
 * GET /api/admin/events/bookings
 * POST /api/admin/events/bookings — double-book check when confirming same space+date.
 */
export async function GET() {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const restaurant = await loadRestaurant(auth.profile.restaurant_id!);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "event_hall_management")) {
    return NextResponse.json(
      { error: "Somali Airlines 1.0 feature", code: "tier_gated", gated: true },
      { status: 403 }
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_bookings")
    .select("*, space:space_id(id, name)")
    .eq("restaurant_id", restaurant.id)
    .order("event_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bookings: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const restaurant = await loadRestaurant(auth.profile.restaurant_id!);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "event_hall_management")) {
    return NextResponse.json(
      { error: "Somali Airlines 1.0 feature", code: "tier_gated", gated: true },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const contactName = String(body.contact_name ?? "").trim();
  const contactPhone = String(body.contact_phone ?? "").trim();
  const eventDate = String(body.event_date ?? "").trim();
  const eventType = EVENT_TYPES.includes(body.event_type) ? (body.event_type as EventType) : null;
  const status =
    body.status === "confirmed" ||
    body.status === "inquiry" ||
    body.status === "cancelled" ||
    body.status === "completed"
      ? body.status
      : "inquiry";
  const spaceId =
    typeof body.space_id === "string" && body.space_id.trim() ? body.space_id.trim() : null;

  if (!contactName || !contactPhone || !eventDate || !eventType) {
    return NextResponse.json(
      { error: "contact_name, contact_phone, event_date, and event_type are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  if (status === "confirmed" && spaceId) {
    const { data: clash } = await admin
      .from("event_bookings")
      .select("id, contact_name")
      .eq("restaurant_id", restaurant.id)
      .eq("space_id", spaceId)
      .eq("event_date", eventDate)
      .eq("status", "confirmed")
      .maybeSingle();

    if (clash) {
      return NextResponse.json(
        {
          error: "This space is already confirmed for that date",
          code: "double_booked",
          conflicting_booking_id: clash.id,
        },
        { status: 409 }
      );
    }
  }

  const insert = {
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
    menu_package: typeof body.menu_package === "string" ? body.menu_package.trim() || null : null,
    total_price:
      body.total_price != null && body.total_price !== "" ? Number(body.total_price) : null,
    deposit_paid: Number(body.deposit_paid) || 0,
    balance_due_date: body.balance_due_date ? String(body.balance_due_date) : null,
    status,
    notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    booking_source: body.booking_source === "online_link" ? "online_link" : "direct",
    created_by: auth.user.id,
  };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_bookings")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking: data as EventBooking }, { status: 201 });
}
