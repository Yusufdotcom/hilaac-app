import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { createAdminClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

const CREATABLE_ROLES: UserRole[] = ["manager", "cashier", "waiter", "kitchen"];

/**
 * POST /api/admin/staff/create
 * Owner creates a staff login (email + temporary password + role).
 * Manager may create floor roles only (not another manager).
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  let body: {
    restaurant_id?: string;
    email?: string;
    full_name?: string;
    role?: string;
    password?: string;
    phone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const restaurantId = body.restaurant_id?.trim();
  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim() || "";
  const role = body.role as UserRole;
  const password = body.password ?? "";
  const phone = body.phone?.trim() || null;

  if (!restaurantId || !email || !role || !password) {
    return NextResponse.json(
      { error: "email, role, password, and restaurant_id are required" },
      { status: 400 }
    );
  }
  if (!CREATABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (profile.role === "manager" && role === "manager") {
    return NextResponse.json(
      { error: "Managers cannot create other managers" },
      { status: 403 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
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

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email.split("@")[0] },
  });

  if (createError || !created.user) {
    const msg = createError?.message ?? "Could not create user";
    const status = /already|registered|exists/i.test(msg) ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      restaurant_id: restaurantId,
      role,
      full_name: fullName || email.split("@")[0],
      phone,
      is_active: true,
      is_platform_admin: false,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  console.info("[staff] account created", {
    restaurantId,
    userId: created.user.id,
    role,
    by: user.id,
  });

  return NextResponse.json({
    ok: true,
    id: created.user.id,
    email,
    role,
  });
}
