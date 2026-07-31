import { getTwilioConfig, isWhatsAppDryRun } from "@/lib/whatsapp/config";

export type TwilioSendResult =
  | { ok: true; dryRun: true; sid: null }
  | { ok: true; dryRun: false; sid: string }
  | { ok: false; dryRun: boolean; error: string };

/**
 * Send a WhatsApp Content template via Twilio REST API.
 * Never throws — callers log failures and continue.
 */
export async function sendWhatsAppTemplate(params: {
  toWhatsApp: string;
  contentSid: string;
  contentVariables: Record<string, string>;
}): Promise<TwilioSendResult> {
  const dryRun = isWhatsAppDryRun();
  const cfg = getTwilioConfig();

  if (dryRun || !cfg.configured || !params.contentSid) {
    console.info("[whatsapp] dry-run / unconfigured send", {
      to: params.toWhatsApp,
      contentSid: params.contentSid || "(missing)",
      variables: params.contentVariables,
      dryRun,
      configured: cfg.configured,
    });
    return { ok: true, dryRun: true, sid: null };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: params.toWhatsApp,
      From: cfg.from,
      ContentSid: params.contentSid,
      ContentVariables: JSON.stringify(params.contentVariables),
    });

    const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const json = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      error_message?: string;
      code?: number;
    };

    if (!res.ok || !json.sid) {
      const error =
        json.error_message || json.message || `Twilio HTTP ${res.status}`;
      console.error("[whatsapp] Twilio send failed", {
        status: res.status,
        code: json.code,
        error,
      });
      return { ok: false, dryRun: false, error };
    }

    return { ok: true, dryRun: false, sid: json.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Twilio request failed";
    console.error("[whatsapp] Twilio send exception", { error });
    return { ok: false, dryRun: false, error };
  }
}
