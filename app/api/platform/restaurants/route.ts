import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createAdminClient } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/utils";

/**
 * GET /api/platform/restaurants
 * Cross-tenant restaurant list for Super Admin dashboard.
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("restaurants")
    .select(
      "id, name, slug, subscription_tier, subscription_status, subscription_end_date, is_active, is_demo, created_at"
    )
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const restaurants = (data ?? []).map((r) => {
    const daysLeft = daysUntil(r.subscription_end_date);
    const expired =
      r.subscription_status === "expired" ||
      (r.subscription_end_date && new Date(r.subscription_end_date) < new Date());
    return {
      ...r,
      days_remaining: daysLeft,
      is_expired: Boolean(expired),
    };
  });

  return NextResponse.json({ restaurants });
}
