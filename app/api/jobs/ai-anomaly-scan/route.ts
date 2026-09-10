import { NextRequest, NextResponse } from "next/server";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import {
  detectAnomaliesForRestaurant,
  upsertAiAlerts,
} from "@/lib/ai/anomaly-scan";
import { isAuthorizedCronRequest } from "@/lib/jobs/verify-cron";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ELIGIBLE_TIERS = new Set(["galeyr", "somali_airlines", "pro", "trial"]);

/**
 * GET /api/jobs/ai-anomaly-scan
 * Every 6 hours — threshold anomaly rules → ai_alerts.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: restaurants, error } = await admin
    .from("restaurants")
    .select("id, slug, subscription_tier, subscription_status")
    .eq("subscription_status", "active");

  if (error) {
    console.error("[ai-anomaly-scan] load restaurants", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let scanned = 0;
  let upserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const restaurant of restaurants ?? []) {
    const tier = String(restaurant.subscription_tier ?? "");
    if (!ELIGIBLE_TIERS.has(tier) && !canUseFeature(tier, "ai_chatbot")) {
      skipped += 1;
      continue;
    }

    scanned += 1;
    try {
      const candidates = await detectAnomaliesForRestaurant(admin, {
        id: restaurant.id,
        slug: restaurant.slug,
      });
      if (candidates.length === 0) continue;
      const result = await upsertAiAlerts(admin, restaurant.id, candidates);
      upserted += result.upserted;
      errors += result.errors;
    } catch (err) {
      console.error("[ai-anomaly-scan] restaurant failed", {
        restaurantId: restaurant.id,
        error: err instanceof Error ? err.message : err,
      });
      errors += 1;
    }
  }

  return NextResponse.json({ scanned, upserted, skipped, errors });
}
