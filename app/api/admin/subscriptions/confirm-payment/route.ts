import { NextRequest, NextResponse } from "next/server";
import { requireAal2ForPrivilegedRole } from "@/lib/auth/aal";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/subscriptions/confirm-payment
 * Manual USSD upgrade confirmation — fail-closed.
 *
 * Requires ALLOW_MANUAL_SUBSCRIPTION_CONFIRM=true, owner/manager + restaurant match,
 * AAL2 for privileged roles, and a non-empty txRef for reconciliation.
 * Billing columns are only writable via service_role after N1/N2 revoke.
 */
export async function POST(req: NextRequest) {
  if (process.env.ALLOW_MANUAL_SUBSCRIPTION_CONFIRM?.trim() !== "true") {
    return NextResponse.json(
      {
        error: "Manual subscription confirmation is disabled",
        code: "manual_confirm_disabled",
      },
      { status: 403 }
    );
  }

  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth;

  let body: { restaurantId?: unknown; method?: unknown; txRef?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  const method = typeof body.method === "string" ? body.method : "";
  const txRef = typeof body.txRef === "string" ? body.txRef.trim() : "";

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  }
  if (!["evc", "edahab"].includes(method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }
  if (!txRef || txRef.length < 4 || txRef.length > 128) {
    return NextResponse.json(
      { error: "txRef required (4–128 chars) for reconciliation" },
      { status: 400 }
    );
  }

  if (profile.restaurant_id !== restaurantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const aal = await requireAal2ForPrivilegedRole(supabase, profile.role);
  if (!aal.ok) return aal.response;

  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({
      subscription_tier: "pro",
      subscription_status: "active",
      subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", restaurantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info("[subscriptions] manual_confirm", {
    restaurantId,
    method,
    txRef,
    userId: user.id,
  });

  return NextResponse.json({ success: true });
}
