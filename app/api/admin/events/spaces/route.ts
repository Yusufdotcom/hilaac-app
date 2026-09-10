import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { EventSpace } from "@/types/database";

export const dynamic = "force-dynamic";

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
 * GET /api/admin/events/spaces
 * POST /api/admin/events/spaces
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
    .from("event_spaces")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ spaces: (data as EventSpace[]) ?? [] });
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
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const insert = {
    restaurant_id: restaurant.id,
    name,
    capacity:
      body.capacity != null && body.capacity !== "" ? Number(body.capacity) : null,
    description: typeof body.description === "string" ? body.description.trim() || null : null,
    price_per_event:
      body.price_per_event != null && body.price_per_event !== ""
        ? Number(body.price_per_event)
        : null,
    is_active: body.is_active === false ? false : true,
  };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_spaces")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ space: data as EventSpace }, { status: 201 });
}
