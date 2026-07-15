import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateSlug } from "@/lib/utils";

/**
 * POST /api/admin/branches
 * Creates a new branch restaurant for Pro plan owners.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("restaurant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.restaurant_id || profile.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: currentRestaurant } = await supabase
    .from("restaurants")
    .select("subscription_tier, subscription_status, subscription_end_date, payment_mode")
    .eq("id", profile.restaurant_id)
    .maybeSingle();

  if (!currentRestaurant || currentRestaurant.subscription_tier !== "pro") {
    return NextResponse.json(
      { error: "Upgrade to Pro to add multiple branches." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const branchName = String(body.branchName ?? "").trim();
  const address = String(body.address ?? "").trim();

  if (!branchName) {
    return NextResponse.json({ error: "Branch name is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const baseSlug = generateSlug(branchName);
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.floor(Math.random() * 1000)}`;

    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .insert({
        name: branchName,
        branch_name: branchName,
        slug,
        address: address || null,
        owner_id: user.id,
        is_active: true,
        subscription_tier: currentRestaurant.subscription_tier,
        subscription_status: currentRestaurant.subscription_status,
        subscription_end_date: currentRestaurant.subscription_end_date,
        payment_mode: currentRestaurant.payment_mode,
      })
      .select("id, slug")
      .single();

    if (restaurantError) {
      lastError = restaurantError.message;
      if (restaurantError.code === "23505") continue;
      return NextResponse.json({ error: restaurantError.message }, { status: 500 });
    }

    await admin.from("tables").insert({ restaurant_id: restaurant.id, table_number: "1" });
    await admin.from("categories").insert([
      { restaurant_id: restaurant.id, name: "Cuntooyinka Ugu Weyn", display_order: 0 },
      { restaurant_id: restaurant.id, name: "Cabitaannada", display_order: 1 },
    ]);

    await admin.from("profiles").update({ restaurant_id: restaurant.id }).eq("id", user.id);

    return NextResponse.json({ success: true, slug: restaurant.slug });
  }

  return NextResponse.json({ error: lastError ?? "Could not create branch." }, { status: 500 });
}
