import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const BAN_DURATION = "876000h"; // ~100 years — reversible via ban_duration: "none"

/**
 * PATCH /api/admin/staff/[id]/status
 * Deactivate / reactivate a non-owner staff profile and ban / unban Auth.
 * Owners are never deactivatable through this route.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const targetId = params.id;
  if (!targetId) {
    return NextResponse.json({ error: "Missing staff id" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabase
    .from("profiles")
    .select("restaurant_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !caller?.restaurant_id ||
    !caller.is_active ||
    !["owner", "manager"].includes(caller.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { is_active?: unknown; restaurant_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "is_active boolean required" }, { status: 400 });
  }

  const restaurantId =
    typeof body.restaurant_id === "string" && body.restaurant_id
      ? body.restaurant_id
      : caller.restaurant_id;

  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const isOwner = caller.role === "owner" && restaurant.owner_id === user.id;
  const isPrimary = caller.restaurant_id === restaurant.id;
  if (!isOwner && !isPrimary) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (targetId === user.id) {
    return NextResponse.json({ error: "Cannot change your own status" }, { status: 403 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("id, restaurant_id, role, is_active")
    .eq("id", targetId)
    .maybeSingle();

  if (!target || target.restaurant_id !== restaurant.id) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  if (target.role === "owner") {
    return NextResponse.json({ error: "Owner accounts cannot be deactivated" }, { status: 403 });
  }

  if (target.is_active === body.is_active) {
    return NextResponse.json({ ok: true, is_active: target.is_active, noop: true });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_active: body.is_active })
    .eq("id", targetId)
    .eq("restaurant_id", restaurant.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: banError } = await admin.auth.admin.updateUserById(targetId, {
    ban_duration: body.is_active ? "none" : BAN_DURATION,
  });

  if (banError) {
    // Roll back profile flag so DB and Auth stay aligned.
    await admin
      .from("profiles")
      .update({ is_active: target.is_active })
      .eq("id", targetId);
    return NextResponse.json({ error: banError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_active: body.is_active });
}
