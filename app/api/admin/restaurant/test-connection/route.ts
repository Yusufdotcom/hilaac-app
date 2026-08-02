import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAal2ForPrivilegedRole } from "@/lib/auth/aal";

/**
 * POST /api/admin/restaurant/test-connection
 * Validates a merchant ID / API key pair against the EVC or eDahab sandbox
 * before the restaurant saves it. Credentials are used in memory only and
 * are never written to the database or logs by this route.
 *
 * Auth: owner/manager only, and profile must match the restaurant being tested
 * (same tenant gate as PATCH /api/admin/restaurant/settings).
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

  if (!profile?.restaurant_id || !["owner", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const aal = await requireAal2ForPrivilegedRole(supabase, profile.role);
  if (!aal.ok) return aal.response;

  let body: {
    provider?: string;
    merchantId?: string;
    apiKey?: string;
    restaurant_id?: string;
    restaurantId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { provider, merchantId, apiKey } = body;
  const restaurantId =
    (typeof body.restaurant_id === "string" && body.restaurant_id) ||
    (typeof body.restaurantId === "string" && body.restaurantId) ||
    profile.restaurant_id;

  if (!provider || !merchantId || !apiKey) {
    return NextResponse.json({ error: "Merchant ID and API key are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const isOwner = profile.role === "owner" && restaurant.owner_id === user.id;
  const isPrimary = profile.restaurant_id === restaurant.id;
  if (!isOwner && !isPrimary) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const baseUrl = provider === "evc" ? process.env.EVC_API_BASE_URL : process.env.EDAHAB_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: `${String(provider).toUpperCase()}_API_BASE_URL is not configured on the server yet.` },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${baseUrl}/merchant/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ merchantId }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "The gateway rejected these credentials." },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, message: "Connection verified successfully." });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Could not reach the payment gateway. Check your network and try again.",
      },
      { status: 200 }
    );
  }
}
