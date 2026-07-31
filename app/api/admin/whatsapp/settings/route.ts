import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_LOYALTY_ROLES, getLoyaltyStaffContext } from "@/lib/loyalty/staff-auth";
import {
  canUseWhatsAppReengagement,
  estimatedCostUsd,
  getTwilioConfig,
  isWhatsAppDryRun,
} from "@/lib/whatsapp/config";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const ctx = await getLoyaltyStaffContext(slug, ADMIN_LOYALTY_ROLES);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: settings }, { data: logs }] = await Promise.all([
    admin
      .from("whatsapp_settings")
      .select(
        "restaurant_id, order_ready_enabled, reengagement_enabled, reengagement_idle_days, reengagement_min_interval_days"
      )
      .eq("restaurant_id", ctx.restaurant.id)
      .maybeSingle(),
    admin
      .from("whatsapp_message_log")
      .select("message_type, status, estimated_cost_usd")
      .eq("restaurant_id", ctx.restaurant.id)
      .gte("created_at", monthStart.toISOString())
      .in("status", ["dry_run", "sent", "queued"]),
  ]);

  let utilityCount = 0;
  let marketingCount = 0;
  let estimatedCost = 0;
  for (const row of logs ?? []) {
    if (row.message_type === "order_ready") utilityCount += 1;
    if (row.message_type === "reengagement") marketingCount += 1;
    estimatedCost += Number(row.estimated_cost_usd) || 0;
  }

  const twilio = getTwilioConfig();

  return NextResponse.json({
    settings: settings ?? {
      restaurant_id: ctx.restaurant.id,
      order_ready_enabled: false,
      reengagement_enabled: false,
      reengagement_idle_days: 14,
      reengagement_min_interval_days: 21,
    },
    usage: {
      month_utility_messages: utilityCount,
      month_marketing_messages: marketingCount,
      month_estimated_cost_usd: Math.round(estimatedCost * 100) / 100,
      utility_unit_cost_usd: estimatedCostUsd("order_ready"),
      marketing_unit_cost_usd: estimatedCostUsd("reengagement"),
    },
    meta: {
      dry_run: isWhatsAppDryRun(),
      twilio_configured: twilio.configured,
      templates_configured: Boolean(
        twilio.orderReadyContentSid && twilio.reengageContentSid
      ),
      reengagement_allowed: canUseWhatsAppReengagement(ctx.restaurant.subscription_tier),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const ctx = await getLoyaltyStaffContext(slug, ADMIN_LOYALTY_ROLES);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orderReadyEnabled = Boolean(body.order_ready_enabled);
  let reengagementEnabled = Boolean(body.reengagement_enabled);
  if (
    reengagementEnabled &&
    !canUseWhatsAppReengagement(ctx.restaurant.subscription_tier)
  ) {
    reengagementEnabled = false;
  }

  const idleDays = Math.floor(Number(body.reengagement_idle_days));
  const intervalDays = Math.floor(Number(body.reengagement_min_interval_days));

  if (!Number.isFinite(idleDays) || idleDays < 7 || idleDays > 90) {
    return NextResponse.json(
      { error: "Idle days must be between 7 and 90." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(intervalDays) || intervalDays < 14 || intervalDays > 60) {
    return NextResponse.json(
      { error: "Min interval must be between 14 and 60 days." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("whatsapp_settings")
    .upsert(
      {
        restaurant_id: ctx.restaurant.id,
        order_ready_enabled: orderReadyEnabled,
        reengagement_enabled: reengagementEnabled,
        reengagement_idle_days: idleDays,
        reengagement_min_interval_days: intervalDays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id" }
    )
    .select(
      "restaurant_id, order_ready_enabled, reengagement_enabled, reengagement_idle_days, reengagement_min_interval_days"
    )
    .single();

  if (error) {
    console.error("[whatsapp] settings upsert", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
