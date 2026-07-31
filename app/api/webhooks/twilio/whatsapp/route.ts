import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";

/**
 * POST /api/webhooks/twilio/whatsapp
 * Inbound WhatsApp messages — mark STOP/opt-out on our contacts table.
 * Prefer enabling Twilio Advanced Opt-Out as well (provider-level suppression).
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const from = String(form.get("From") ?? "");
    const body = String(form.get("Body") ?? "").trim().toUpperCase();

    const phone = normalizeWhatsAppPhone(from.replace(/^whatsapp:/i, ""));
    if (!phone) {
      return NextResponse.json({ ok: true });
    }

    const optOutKeywords = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
    if (!optOutKeywords.some((k) => body === k || body.startsWith(`${k} `))) {
      return NextResponse.json({ ok: true });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("whatsapp_contacts")
      .update({
        opted_out_at: new Date().toISOString(),
        marketing_opt_in: false,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_normalized", phone);

    if (error) {
      console.error("[whatsapp] opt-out update failed", error.message);
    } else {
      console.info("[whatsapp] contact opted out", { phone: phone.slice(0, 6) + "…" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[whatsapp] webhook error", err);
    return NextResponse.json({ ok: true });
  }
}
