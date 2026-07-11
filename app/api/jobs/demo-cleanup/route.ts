import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/verify-cron";

/**
 * GET /api/jobs/demo-cleanup
 * Purges "Try Demo" restaurants (and their cascading tables/menu/orders)
 * once they pass their 24-hour demo_expires_at deadline.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("cleanup_expired_demos");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
