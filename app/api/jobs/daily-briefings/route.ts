import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import {
  buildDailyBriefingContext,
  dailyBriefingSystemPrompt,
} from "@/lib/ai/daily-briefing";
import { HILAAC_AI_MODEL } from "@/lib/ai/model";
import { isAuthorizedCronRequest } from "@/lib/jobs/verify-cron";
import { resolveOwnerContact } from "@/lib/platform/resolve-owner-contact";
import { createAdminClient } from "@/lib/supabase/server";
import { getZonedYmd } from "@/lib/time/app-calendar";
import { getTwilioConfig } from "@/lib/whatsapp/config";
import { toWhatsAppAddress } from "@/lib/whatsapp/phone";
import { sendWhatsAppText } from "@/lib/whatsapp/twilio";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ELIGIBLE_TIERS = new Set(["galeyr", "somali_airlines", "pro", "trial"]);

function todayYmd(): string {
  const ymd = getZonedYmd(new Date());
  return `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;
}

/**
 * GET /api/jobs/daily-briefings
 * 03:00 UTC cron — morning briefing (6:00 AM EAT) for Galeyr+ restaurants.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const briefingDate = todayYmd();
  const twilio = getTwilioConfig();

  const { data: restaurants, error } = await admin
    .from("restaurants")
    .select("id, name, slug, owner_id, subscription_tier, subscription_status")
    .eq("subscription_status", "active");

  if (error) {
    console.error("[daily-briefings] load restaurants", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let stored = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const restaurant of restaurants ?? []) {
    const tier = String(restaurant.subscription_tier ?? "");
    if (!ELIGIBLE_TIERS.has(tier) && !canUseFeature(tier, "ai_chatbot")) {
      skipped += 1;
      continue;
    }
    if (!restaurant.owner_id) {
      skipped += 1;
      continue;
    }

    processed += 1;

    try {
      const { data: ownerProfile } = await admin
        .from("profiles")
        .select("preferred_language")
        .eq("id", restaurant.owner_id)
        .maybeSingle();

      const language: "en" | "so" =
        ownerProfile?.preferred_language === "so" ? "so" : "en";

      const context = await buildDailyBriefingContext(
        admin,
        restaurant.id,
        restaurant.name || restaurant.slug
      );

      const result = await generateText({
        model: HILAAC_AI_MODEL,
        system: dailyBriefingSystemPrompt(language),
        prompt: `Restaurant: ${context.restaurantName}\nYesterday window (app day): ${context.window.start} → ${context.window.end}\nData JSON:\n${JSON.stringify(context)}`,
      });

      const content = result.text?.trim();
      if (!content) {
        console.error("[daily-briefings] empty openai response", {
          restaurantId: restaurant.id,
        });
        failed += 1;
        continue;
      }

      const { error: upsertError } = await admin.from("daily_briefings").upsert(
        {
          restaurant_id: restaurant.id,
          briefing_date: briefingDate,
          content,
          language,
        },
        { onConflict: "restaurant_id,briefing_date" }
      );

      if (upsertError) {
        console.error("[daily-briefings] upsert", upsertError.message);
        failed += 1;
        continue;
      }
      stored += 1;

      if (!twilio.configured) {
        console.info("[daily-briefings] Twilio not configured — briefing stored, WhatsApp skipped", {
          restaurantId: restaurant.id,
        });
        continue;
      }

      const contact = await resolveOwnerContact(admin, {
        ownerId: restaurant.owner_id,
        restaurantId: restaurant.id,
      });
      const to = toWhatsAppAddress(contact.phone);
      if (!to) {
        console.info("[daily-briefings] no owner phone — WhatsApp skipped", {
          restaurantId: restaurant.id,
        });
        continue;
      }

      const wa = await sendWhatsAppText({
        toWhatsApp: to,
        body: `Hilaac — Today's Briefing\n\n${content}`,
      });
      if (wa.ok) {
        sent += 1;
        if (wa.dryRun) {
          console.info("[daily-briefings] WhatsApp dry-run", { restaurantId: restaurant.id });
        }
      } else {
        console.error("[daily-briefings] WhatsApp failed", {
          restaurantId: restaurant.id,
          error: wa.error,
        });
        failed += 1;
      }
    } catch (err) {
      console.error("[daily-briefings] restaurant failed", {
        restaurantId: restaurant.id,
        error: err instanceof Error ? err.message : err,
      });
      failed += 1;
    }
  }

  return NextResponse.json({
    briefingDate,
    processed,
    stored,
    sent,
    skipped,
    failed,
    twilioConfigured: twilio.configured,
  });
}
