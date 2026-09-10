import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { RamadanPackage, SeasonKind } from "@/types/database";

export const dynamic = "force-dynamic";

async function loadRestaurantForStaff(restaurantId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurants")
    .select("id, subscription_tier, active_season, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  return data;
}

/**
 * GET /api/admin/packages — list packages for the staff restaurant.
 * POST /api/admin/packages — create a package (owner/manager).
 */
export async function GET() {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const restaurant = await loadRestaurantForStaff(auth.profile.restaurant_id!);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "ramadan_packages")) {
    return NextResponse.json(
      { error: "Somali Airlines 1.0 feature", code: "tier_gated", gated: true },
      { status: 403 }
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("ramadan_packages")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ packages: (data as RamadanPackage[]) ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const restaurant = await loadRestaurantForStaff(auth.profile.restaurant_id!);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "ramadan_packages")) {
    return NextResponse.json(
      { error: "Somali Airlines 1.0 feature", code: "tier_gated", gated: true },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const type = body.type === "buffet" ? "buffet" : body.type === "normal" ? "normal" : null;
  const price = Number(body.price);
  const validFrom = String(body.valid_from ?? "").trim();
  const validTo = String(body.valid_to ?? "").trim();
  const seasonRaw = String(body.season ?? restaurant.active_season ?? "").trim();
  const season: SeasonKind | null =
    seasonRaw === "ramadan" || seasonRaw === "eid" ? seasonRaw : null;

  if (!name || !type || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "name, type, and price are required" }, { status: 400 });
  }
  if (!validFrom || !validTo) {
    return NextResponse.json({ error: "valid_from and valid_to are required" }, { status: 400 });
  }
  if (!season) {
    return NextResponse.json(
      { error: "Enable Ramadan or Eid Mode in Settings before creating packages" },
      { status: 400 }
    );
  }

  const mealType =
    body.meal_type === "iftar" || body.meal_type === "suhoor" || body.meal_type === "both"
      ? body.meal_type
      : null;

  const insert = {
    restaurant_id: restaurant.id,
    name,
    type,
    price,
    description: typeof body.description === "string" ? body.description.trim() || null : null,
    menu_items: body.menu_items ?? null,
    buffet_start_time: type === "buffet" && body.buffet_start_time ? String(body.buffet_start_time) : null,
    buffet_end_time: type === "buffet" && body.buffet_end_time ? String(body.buffet_end_time) : null,
    max_daily_capacity:
      type === "buffet" && body.max_daily_capacity != null && body.max_daily_capacity !== ""
        ? Number(body.max_daily_capacity)
        : null,
    valid_from: validFrom,
    valid_to: validTo,
    meal_type: mealType,
    season,
    is_active: body.is_active === false ? false : true,
  };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("ramadan_packages")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ package: data as RamadanPackage }, { status: 201 });
}
