import { getTwilioConfig, isWhatsAppDryRun } from "@/lib/whatsapp/config";
import { maskPhoneForLog } from "@/lib/privacy/mask-phone";

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
  forceLive?: boolean;
}): Promise<TwilioSendResult> {
  const dryRun = params.forceLive ? false : isWhatsAppDryRun();
  const cfg = getTwilioConfig();

  if (dryRun || !cfg.configured || !params.contentSid) {
    console.info("[whatsapp] dry-run / unconfigured send", {
      to: maskPhoneForLog(params.toWhatsApp),
      contentSid: params.contentSid || "(missing)",
      variableKeys: Object.keys(params.contentVariables),
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

/**
 * Freeform WhatsApp body (session / sandbox). Used for subscription reminders
 * when no ContentSid template is configured yet.
 */
export async function sendWhatsAppText(params: {
  toWhatsApp: string;
  body: string;
  forceLive?: boolean;
}): Promise<TwilioSendResult> {
  const dryRun = params.forceLive ? false : isWhatsAppDryRun();
  const cfg = getTwilioConfig();

  if (dryRun || !cfg.configured) {
    console.info("[whatsapp] dry-run / unconfigured text send", {
      to: maskPhoneForLog(params.toWhatsApp),
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
      Body: params.body,
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
      const error = json.error_message || json.message || `Twilio HTTP ${res.status}`;
      console.error("[whatsapp] Twilio text send failed", { status: res.status, code: json.code, error });
      return { ok: false, dryRun: false, error };
    }
    return { ok: true, dryRun: false, sid: json.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Twilio request failed";
    console.error("[whatsapp] Twilio text send exception", { error });
    return { ok: false, dryRun: false, error };
  }
}
