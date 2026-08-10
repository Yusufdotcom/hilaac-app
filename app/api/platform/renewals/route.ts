import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/platform/renewals?status=pending_confirmation
 * Lists subscription renewal requests across all tenants.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  const status = req.nextUrl.searchParams.get("status") ?? "pending_confirmation";
  const allowed = ["pending_confirmation", "confirmed", "rejected", "all"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();
  let query = admin
    .from("subscription_renewals")
    .select(
      `
      id, restaurant_id, requested_by, tier, amount, method, status, tx_ref,
      confirmed_by, confirmed_at, created_at, updated_at,
      restaurants ( id, name, slug, subscription_tier, subscription_status, subscription_end_date )
    `
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ renewals: data ?? [] });
}
