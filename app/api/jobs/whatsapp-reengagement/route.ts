import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/jobs/verify-cron";
import { createAdminClient } from "@/lib/supabase/server";
import { isWhatsAppDryRun } from "@/lib/whatsapp/config";
import {
  findReengagementCandidates,
  sendReengagementMessage,
} from "@/lib/whatsapp/reengagement";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/whatsapp-reengagement
 * Daily cron. Default is dry-run (WHATSAPP_DRY_RUN=true or ?dryRun=1).
 * Live sends require WHATSAPP_DRY_RUN=false and ?live=1 (belt-and-suspenders).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl;
  const forceDry = url.searchParams.get("dryRun") === "1";
  const forceLive = url.searchParams.get("live") === "1";
  const dryRun = forceDry || (!forceLive && isWhatsAppDryRun());

  const supabase = createAdminClient();
  const candidates = await findReengagementCandidates(supabase);

  if (dryRun) {
    console.info("[whatsapp] reengagement dry-run", {
      count: candidates.length,
      sample: candidates.slice(0, 10).map((c) => ({
        restaurant: c.restaurant_name,
        phone: c.phone_normalized.slice(0, 6) + "…",
        idle_days: c.idle_days,
      })),
    });
    return NextResponse.json({
      dryRun: true,
      eligible: candidates.length,
      candidates: candidates.map((c) => ({
        restaurant_id: c.restaurant_id,
        restaurant_name: c.restaurant_name,
        phone_normalized: c.phone_normalized,
        idle_days: c.idle_days,
        last_order_at: c.last_order_at,
      })),
    });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const result = await sendReengagementMessage(supabase, candidate);
    if (result.sent) sent += 1;
    else if (result.error) failed += 1;
    else skipped += 1;
  }

  return NextResponse.json({
    dryRun: false,
    eligible: candidates.length,
    sent,
    failed,
    skipped,
  });
}
