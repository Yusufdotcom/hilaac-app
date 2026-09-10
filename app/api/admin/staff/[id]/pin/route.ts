import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { hashStaffPin, isValidStaffPin } from "@/lib/auth/staff-pin-hash";
import { isPinEligibleRole } from "@/lib/auth/staff-pin-session";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/staff/[id]/pin
 * Owner/manager sets or clears a staff PIN (4–6 digits). Floor roles only.
 * Body: { restaurant_id, pin?: string | null } — null/empty clears PIN.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const staffId = params.id;
  if (!staffId) {
    return NextResponse.json({ error: "Missing staff id" }, { status: 400 });
  }

  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  let body: { restaurant_id?: string; pin?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const restaurantId = body.restaurant_id?.trim();
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const isOwner = profile.role === "owner" && restaurant.owner_id === user.id;
  const isPrimary = profile.restaurant_id === restaurantId;
  if (!isOwner && !isPrimary) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("id, restaurant_id, role, is_active")
    .eq("id", staffId)
    .maybeSingle();

  if (!target || target.restaurant_id !== restaurantId) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }
  if (!isPinEligibleRole(target.role)) {
    return NextResponse.json(
      { error: "PIN is only for Kitchen, Waiter, and Cashier" },
      { status: 400 }
    );
  }

  const pinRaw = body.pin;
  if (pinRaw == null || String(pinRaw).trim() === "") {
    const { error } = await admin
      .from("profiles")
      .update({ staff_pin_hash: null, pin_last_used: null })
      .eq("id", staffId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const pin = String(pinRaw).trim();
  if (!isValidStaffPin(pin)) {
    return NextResponse.json({ error: "PIN must be 4–6 digits" }, { status: 400 });
  }

  // Ensure PIN is unique within the restaurant (shared tablets).
  const { data: others } = await admin
    .from("profiles")
    .select("id, staff_pin_hash")
    .eq("restaurant_id", restaurantId)
    .not("staff_pin_hash", "is", null)
    .neq("id", staffId);

  const { verifyStaffPin } = await import("@/lib/auth/staff-pin-hash");
  for (const row of others ?? []) {
    if (row.staff_pin_hash && verifyStaffPin(pin, row.staff_pin_hash)) {
      return NextResponse.json(
        { error: "That PIN is already used by another staff member" },
        { status: 409 }
      );
    }
  }

  let hash: string;
  try {
    hash = hashStaffPin(pin);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid PIN" },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("profiles")
    .update({ staff_pin_hash: hash })
    .eq("id", staffId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, set: true });
}
