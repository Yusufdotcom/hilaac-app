import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export type PaymentWebhookProvider = "evc" | "edahab";

export type WebhookAuthFailureReason =
  | "secret_not_configured"
  | "ip_not_allowed"
  | "missing_signature"
  | "invalid_signature"
  | "timestamp_skew"
  | "malformed_waafipay_headers";

export type WebhookAuthResult =
  | { ok: true; mode: "hilaac" | "waafipay"; eventId: string | null }
  | { ok: false; reason: WebhookAuthFailureReason };

function timingSafeHexEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length === 0 || ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

function isIpAllowed(req: NextRequest): boolean {
  const raw = process.env.PAYMENT_WEBHOOK_IP_ALLOWLIST?.trim();
  if (!raw) return true;
  const allowed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  const ip = getClientIp(req);
  if (!ip) return false;
  return allowed.includes(ip);
}

function webhookSecretFor(provider: PaymentWebhookProvider): string | null {
  const specific =
    provider === "evc"
      ? process.env.EVC_WEBHOOK_SECRET?.trim()
      : process.env.EDAHAB_WEBHOOK_SECRET?.trim();
  if (specific) return specific;
  return process.env.PAYMENT_WEBHOOK_SECRET?.trim() || null;
}

function verifyHilaacHmac(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const provided = signatureHeader.trim().replace(/^sha256=/i, "").toLowerCase();
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return timingSafeHexEqual(expected, provided);
}

function verifyWaafiPayHmac(
  rawBody: string,
  req: NextRequest,
  secret: string
): { ok: true; eventId: string } | { ok: false; reason: WebhookAuthFailureReason } {
  const signature = req.headers.get("x-webhook-signature")?.trim().toLowerCase();
  const timestamp = req.headers.get("x-webhook-timestamp")?.trim();
  const eventId = req.headers.get("x-webhook-event-id")?.trim();

  if (!signature || !timestamp || !eventId) {
    return { ok: false, reason: "malformed_waafipay_headers" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "malformed_waafipay_headers" };
  }

  const skewSec = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skewSec > 5 * 60) {
    return { ok: false, reason: "timestamp_skew" };
  }

  const signingString = `${timestamp}.${eventId}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signingString, "utf8").digest("hex");
  if (!timingSafeHexEqual(expected, signature)) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true, eventId };
}

/**
 * Authenticate an inbound payment webhook.
 * Fail-closed when no webhook secret is configured.
 */
export function authenticatePaymentWebhook(
  req: NextRequest,
  provider: PaymentWebhookProvider,
  rawBody: string
): WebhookAuthResult {
  const secret = webhookSecretFor(provider);
  if (!secret) {
    return { ok: false, reason: "secret_not_configured" };
  }

  if (!isIpAllowed(req)) {
    return { ok: false, reason: "ip_not_allowed" };
  }

  const waafiSig = req.headers.get("x-webhook-signature");
  if (waafiSig) {
    const waafi = verifyWaafiPayHmac(rawBody, req, secret);
    if (!waafi.ok) return waafi;
    return { ok: true, mode: "waafipay", eventId: waafi.eventId };
  }

  const hilaacSig =
    req.headers.get("x-hilaac-webhook-signature") ?? req.headers.get("x-webhook-signature-sha256");
  if (!hilaacSig) {
    return { ok: false, reason: "missing_signature" };
  }

  if (!verifyHilaacHmac(rawBody, hilaacSig, secret)) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true, mode: "hilaac", eventId: null };
}

export function logWebhookAuthFailure(
  provider: PaymentWebhookProvider,
  reason: WebhookAuthFailureReason,
  req: NextRequest
): void {
  console.warn("[payments] webhook_auth_failed", {
    provider,
    reason,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent")?.slice(0, 120) ?? null,
  });
}

/** Deterministic event key for idempotency when provider event id is absent. */
export function webhookEventFingerprint(
  provider: PaymentWebhookProvider,
  reference: string,
  status: string,
  transactionId: string | null
): string {
  return createHash("sha256")
    .update(`${provider}|${reference}|${status}|${transactionId ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}
