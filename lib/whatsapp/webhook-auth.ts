import twilio from "twilio";
import type { NextRequest } from "next/server";

export type TwilioWebhookAuthFailureReason =
  | "secret_not_configured"
  | "missing_signature"
  | "invalid_signature";

export type TwilioWebhookAuthResult =
  | { ok: true }
  | { ok: false; reason: TwilioWebhookAuthFailureReason };

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

function webhookUrl(req: NextRequest): string {
  const configured = process.env.TWILIO_WHATSAPP_WEBHOOK_URL?.trim();
  if (configured) return configured;

  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host");
  if (!host) return req.nextUrl.toString();
  return `${proto}://${host}${req.nextUrl.pathname}`;
}

/**
 * Authenticate an inbound Twilio WhatsApp webhook.
 * Fail-closed when TWILIO_AUTH_TOKEN is missing (same pattern as payment webhooks).
 */
export function authenticateTwilioWebhook(
  req: NextRequest,
  params: Record<string, string>
): TwilioWebhookAuthResult {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) {
    return { ok: false, reason: "secret_not_configured" };
  }

  const signature = req.headers.get("x-twilio-signature")?.trim();
  if (!signature) {
    return { ok: false, reason: "missing_signature" };
  }

  const url = webhookUrl(req);
  const valid = twilio.validateRequest(authToken, signature, url, params);
  if (!valid) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true };
}

export function logTwilioWebhookAuthFailure(
  reason: TwilioWebhookAuthFailureReason,
  req: NextRequest
): void {
  console.warn("[whatsapp] webhook_auth_failed", {
    reason,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent")?.slice(0, 120) ?? null,
  });
}

/** Parse application/x-www-form-urlencoded body into string params for validateRequest. */
export function parseTwilioFormBody(rawBody: string): Record<string, string> {
  const params: Record<string, string> = {};
  const search = new URLSearchParams(rawBody);
  for (const [key, value] of search.entries()) {
    params[key] = value;
  }
  return params;
}
