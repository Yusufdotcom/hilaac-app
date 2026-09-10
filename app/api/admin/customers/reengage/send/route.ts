import { NextRequest, NextResponse } from "next/server";
import { requireAal2ForPrivilegedRole } from "@/lib/auth/aal";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createAdminClient } from "@/lib/supabase/server";
import { getTwilioConfig } from "@/lib/whatsapp/config";
import { toWhatsAppAddress } from "@/lib/whatsapp/phone";
import { sendWhatsAppText } from "@/lib/whatsapp/twilio";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/customers/reengage/send
 * Body: { customerPhone, message, campaignId? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const aal = await requireAal2ForPrivilegedRole(auth.supabase, auth.profile.role);
  if (!aal.ok) return aal.response;

  const restaurantId = auth.profile.restaurant_id!;
  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, subscription_tier")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "customer_intelligence")) {
    return NextResponse.json({ error: "Galeyr exclusive", gated: true }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    customerPhone?: string;
    message?: string;
    campaignId?: string | null;
  };

  const customerPhone = String(body.customerPhone ?? "").trim();
  let message = String(body.message ?? "").trim();
  const campaignId =
    typeof body.campaignId === "string" && body.campaignId.trim()
      ? body.campaignId.trim()
      : null;

  if (!customerPhone || !message) {
    return NextResponse.json({ error: "customerPhone and message required" }, { status: 400 });
  }
  if (message.length > 800) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  if (campaignId) {
    const { data: campaign } = await admin
      .from("campaigns")
      .select("id, code, name, is_active")
      .eq("id", campaignId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!campaign || !campaign.is_active) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 400 });
    }
    if (!message.includes(campaign.code)) {
      message = `${message}\n\nCode: ${campaign.code}`;
    }
  }

  const twilio = getTwilioConfig();
  if (!twilio.configured) {
    console.error("[reengage/send] Twilio not configured");
    return NextResponse.json(
      {
        error:
          "WhatsApp is not configured. Add Twilio credentials, then try again. Message was not sent.",
        code: "twilio_unconfigured",
      },
      { status: 503 }
    );
  }

  const to = toWhatsAppAddress(customerPhone);
  if (!to) {
    return NextResponse.json({ error: "Invalid customer phone" }, { status: 400 });
  }

  const result = await sendWhatsAppText({ toWhatsApp: to, body: message });
  if (!result.ok) {
    console.error("[reengage/send] Twilio failed", result.error);
    return NextResponse.json(
      { error: result.error || "WhatsApp send failed" },
      { status: 502 }
    );
  }

  const { error: logError } = await admin.from("customer_outreach_log").insert({
    restaurant_id: restaurantId,
    customer_phone: customerPhone,
    message,
    campaign_id: campaignId,
    sent_by: auth.user.id,
  });

  if (logError) {
    console.error("[reengage/send] outreach log", logError.message);
  }

  return NextResponse.json({
    ok: true,
    dryRun: result.dryRun,
    sid: result.sid,
  });
}
