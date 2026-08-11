import { NextRequest, NextResponse } from "next/server";
import { requireAal2ForPrivilegedRole } from "@/lib/auth/aal";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import {
  parseRenewalIntent,
  renewalAmountForTier,
  resolveRenewalTier,
  type BillableTier,
} from "@/lib/platform/subscription-renewal";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/subscriptions/renewals
 * Owner/manager creates a pending_confirmation renewal for their own restaurant.
 * Confirmation is platform_admin only.
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const aal = await requireAal2ForPrivilegedRole(auth.supabase, auth.profile.role);
  if (!aal.ok) return aal.response;

  let body: {
    restaurantId?: unknown;
    method?: unknown;
    intent?: unknown;
    txRef?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const restaurantId =
    typeof body.restaurantId === "string" && body.restaurantId
      ? body.restaurantId
      : auth.profile.restaurant_id;

  if (!restaurantId || auth.profile.restaurant_id !== restaurantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const method = typeof body.method === "string" ? body.method : "";
  if (!["evc", "edahab"].includes(method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  const intent = parseRenewalIntent(body.intent);

  const txRef =
    typeof body.txRef === "string" && body.txRef.trim()
      ? body.txRef.trim().slice(0, 128)
      : null;

  const admin = createAdminClient();
  const { data: restaurant, error: restErr } = await admin
    .from("restaurants")
    .select("id, subscription_tier")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restErr || !restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const tier: BillableTier = resolveRenewalTier(restaurant.subscription_tier, intent);
  const amount = renewalAmountForTier(tier);

  // Avoid duplicate pending renewals for same restaurant.
  const { data: existing } = await admin
    .from("subscription_renewals")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending_confirmation")
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: "A renewal is already awaiting Hilaac confirmation.",
        code: "already_pending",
        renewalId: existing.id,
      },
      { status: 409 }
    );
  }

  const { data: renewal, error } = await admin
    .from("subscription_renewals")
    .insert({
      restaurant_id: restaurantId,
      requested_by: auth.user.id,
      tier,
      amount,
      method,
      status: "pending_confirmation",
      tx_ref: txRef,
    })
    .select("id, restaurant_id, tier, amount, method, status, created_at")
    .single();

  if (error || !renewal) {
    return NextResponse.json({ error: error?.message ?? "Could not create renewal" }, { status: 500 });
  }

  console.info("[subscriptions] renewal_requested", {
    renewalId: renewal.id,
    restaurantId,
    tier,
    amount,
    method,
    intent,
    userId: auth.user.id,
  });

  return NextResponse.json({ renewal }, { status: 201 });
}

/**
 * GET /api/admin/subscriptions/renewals
 * Owner/manager: pending renewals for their restaurant only.
 */
export async function GET() {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscription_renewals")
    .select("id, tier, amount, method, status, tx_ref, created_at, confirmed_at")
    .eq("restaurant_id", auth.profile.restaurant_id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ renewals: data ?? [] });
}
