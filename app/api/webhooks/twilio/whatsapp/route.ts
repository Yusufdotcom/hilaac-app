import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import {
  authenticateTwilioWebhook,
  logTwilioWebhookAuthFailure,
  parseTwilioFormBody,
} from "@/lib/whatsapp/webhook-auth";
import { maskPhoneForLog } from "@/lib/privacy/mask-phone";

/**
 * POST /api/webhooks/twilio/whatsapp
 * Inbound WhatsApp messages — mark STOP/opt-out on our contacts table.
 * Prefer enabling Twilio Advanced Opt-Out as well (provider-level suppression).
 *
 * Auth: Twilio X-Twilio-Signature (fail-closed, same idea as C3 payment webhooks).
 * Post-auth DB failures return 500 so Twilio retries — never swallow as { ok: true }.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const params = parseTwilioFormBody(rawBody);

  const auth = authenticateTwilioWebhook(req, params);
  if (!auth.ok) {
    logTwilioWebhookAuthFailure(auth.reason, req);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const from = String(params.From ?? "");
    const body = String(params.Body ?? "").trim().toUpperCase();

    const phone = normalizeWhatsAppPhone(from.replace(/^whatsapp:/i, ""));
    if (!phone) {
      // Authenticated but nothing actionable — acknowledge without claiming an opt-out.
      return NextResponse.json({ ok: true, ignored: "invalid_phone" });
    }

    const optOutKeywords = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
    if (!optOutKeywords.some((k) => body === k || body.startsWith(`${k} `))) {
      return NextResponse.json({ ok: true, ignored: "not_opt_out" });
    }

    const admin = createAdminClient();
    // Phone may exist under multiple restaurants — opt out all matching rows.
    const { data, error } = await admin
      .from("whatsapp_contacts")
      .update({
        opted_out_at: new Date().toISOString(),
        marketing_opt_in: false,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_normalized", phone)
      .select("id");

    if (error) {
      console.error("[whatsapp] opt-out update failed", error.message);
      return NextResponse.json({ error: "Opt-out persist failed" }, { status: 500 });
    }

    const matched = data?.length ?? 0;
    console.info("[whatsapp] contact opted out", {
      phone: maskPhoneForLog(phone),
      matched,
    });
    return NextResponse.json({ ok: true, opted_out: true, matched });
  } catch (err) {
    console.error("[whatsapp] webhook error", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
