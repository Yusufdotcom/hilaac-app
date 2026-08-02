import { createHmac, timingSafeEqual } from "crypto";

/** Short-lived token for API charge + USSD confirm. */
const DEFAULT_TTL_SEC = 15 * 60;
/** Longer-lived token for customer order status polling. */
export const ORDER_ACCESS_TTL_SEC = 24 * 60 * 60;

function getChargeTokenSecret(): string {
  const secret = process.env.CHARGE_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new Error("CHARGE_TOKEN_SECRET is not set");
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Mint a short-lived capability token bound to a specific order + restaurant. */
export function mintChargeToken(
  orderId: string,
  restaurantId: string,
  ttlSec = DEFAULT_TTL_SEC
): string {
  const secret = getChargeTokenSecret();
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${orderId}.${restaurantId}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Mint a longer-lived token for GET /track (same HMAC format as chargeToken). */
export function mintOrderAccessToken(orderId: string, restaurantId: string): string {
  return mintChargeToken(orderId, restaurantId, ORDER_ACCESS_TTL_SEC);
}

export type ChargeTokenClaims = {
  orderId: string;
  restaurantId: string;
  exp: number;
};

export type VerifyChargeTokenResult =
  | { ok: true; claims: ChargeTokenClaims }
  | { ok: false; reason: string };

/** Verify token signature, expiry, and optional order/restaurant binding. */
export function verifyChargeToken(
  token: string | null | undefined,
  expected?: { orderId: string; restaurantId?: string }
): VerifyChargeTokenResult {
  if (!token?.trim()) {
    return { ok: false, reason: "missing_token" };
  }

  let secret: string;
  try {
    secret = getChargeTokenSecret();
  } catch {
    return { ok: false, reason: "secret_not_configured" };
  }

  const parts = token.trim().split(".");
  if (parts.length !== 4) {
    return { ok: false, reason: "malformed_token" };
  }

  const [orderId, restaurantId, expStr, sig] = parts;
  const payload = `${orderId}.${restaurantId}.${expStr}`;
  const expectedSig = sign(payload, secret);
  if (!safeEqual(expectedSig, sig)) {
    return { ok: false, reason: "invalid_signature" };
  }

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }

  if (expected?.orderId && expected.orderId !== orderId) {
    return { ok: false, reason: "order_mismatch" };
  }
  if (expected?.restaurantId && expected.restaurantId !== restaurantId) {
    return { ok: false, reason: "restaurant_mismatch" };
  }

  return { ok: true, claims: { orderId, restaurantId, exp } };
}
