import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifyStaffPin } from "@/lib/auth/staff-pin-hash";
import {
  applyStaffPinCookie,
  isPinEligibleRole,
  mintStaffPinToken,
  STAFF_PIN_TTL_SEC,
} from "@/lib/auth/staff-pin-session";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/staff/pin/login
 * Public (tablet) — verify PIN, mint 8h staff-PIN cookie, and establish a real
 * Supabase session for that staff user so RLS order updates keep working.
 */
export async function POST(req: NextRequest) {
  let body: { slug?: string; pin?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = body.slug?.trim();
  const pin = String(body.pin ?? "").trim();
  const preferredRole = body.role?.trim();

  if (!slug || !pin) {
    return NextResponse.json({ error: "slug and pin required" }, { status: 400 });
  }
  if (preferredRole && !isPinEligibleRole(preferredRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anon) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, slug, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant || restaurant.is_active === false) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const { data: candidates, error } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active, staff_pin_hash")
    .eq("restaurant_id", restaurant.id)
    .eq("is_active", true)
    .not("staff_pin_hash", "is", null)
    .in("role", preferredRole ? [preferredRole] : ["kitchen", "waiter", "cashier"]);

  if (error) {
    return NextResponse.json({ error: "Could not verify PIN" }, { status: 500 });
  }

  const match = (candidates ?? []).find(
    (row) => row.staff_pin_hash && verifyStaffPin(pin, row.staff_pin_hash)
  );

  if (!match || !isPinEligibleRole(match.role)) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(match.id);
  const email = userData.user?.email;
  if (userError || !email) {
    return NextResponse.json(
      { error: "Staff account has no email — recreate the account" },
      { status: 400 }
    );
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkError?.message || "Could not start session" },
      { status: 500 }
    );
  }

  const cookieBag: { name: string; value: string; options?: Record<string, unknown> }[] = [];
  const userClient = createServerClient(supabaseUrl, anon, {
    cookies: {
      getAll: () => cookieBag.map(({ name, value }) => ({ name, value })),
      setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        for (const c of cookies) {
          const i = cookieBag.findIndex((x) => x.name === c.name);
          if (i >= 0) cookieBag[i] = c;
          else cookieBag.push(c);
        }
      },
    },
  });

  const verified = await userClient.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });
  if (verified.error || !verified.data.session) {
    return NextResponse.json(
      { error: verified.error?.message || "Could not create session" },
      { status: 500 }
    );
  }

  const pinToken = await mintStaffPinToken({
    profileId: match.id,
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    role: match.role,
    fullName: match.full_name?.trim() || match.role,
  });

  await admin
    .from("profiles")
    .update({ pin_last_used: new Date().toISOString() })
    .eq("id", match.id);

  const res = NextResponse.json({
    ok: true,
    role: match.role,
    fullName: match.full_name,
    redirectTo: `/staff/${restaurant.slug}/${match.role}`,
  });

  for (const c of cookieBag) {
    res.cookies.set(c.name, c.value, {
      ...(c.options as object),
      // Cap tablet sessions at 8h regardless of refresh token defaults.
      maxAge: STAFF_PIN_TTL_SEC,
      path: "/",
    });
  }
  applyStaffPinCookie(res, pinToken, STAFF_PIN_TTL_SEC);
  return res;
}
