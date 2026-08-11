import type { NextRequest, NextResponse } from "next/server";

/**
 * Platform support-session cookie helpers.
 * Edge-safe: uses Web Crypto (crypto.subtle) — never Node.js `crypto`.
 * Middleware imports this module; Node-only APIs must stay out.
 */

/** HttpOnly cookie: platform admin is viewing a tenant admin console. */
export const PLATFORM_SUPPORT_COOKIE = "hilaac_platform_support";

const DEFAULT_TTL_SEC = 8 * 60 * 60;

export type PlatformSupportSession = {
  restaurantId: string;
  slug: string;
  userId: string;
  exp: number;
};

function getSecretOrNull(): string | null {
  const secret =
    process.env.PLATFORM_SUPPORT_SECRET?.trim() ||
    process.env.CHARGE_TOKEN_SECRET?.trim() ||
    process.env.ENCRYPTION_SECRET_KEY?.trim();
  return secret || null;
}

function requireSecret(): string {
  const secret = getSecretOrNull();
  if (!secret) {
    throw new Error("PLATFORM_SUPPORT_SECRET (or CHARGE_TOKEN_SECRET) is not set");
  }
  return secret;
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa is available in Edge + Node 18+
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bufferToBase64Url(sig);
}

/** Mint a user-bound support token for tenant Open (Node/Edge Web Crypto). */
export async function mintPlatformSupportToken(
  userId: string,
  restaurantId: string,
  slug: string,
  ttlSec = DEFAULT_TTL_SEC
): Promise<string> {
  const secret = requireSecret();
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${userId}.${restaurantId}.${slug}.${exp}`;
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyPlatformSupportToken(
  token: string | undefined | null,
  userId: string
): Promise<PlatformSupportSession | null> {
  if (!token) return null;
  const secret = getSecretOrNull();
  // Fail closed without crashing middleware when env is missing.
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [uid, restaurantId, slug, expStr, sig] = parts;
  if (!uid || !restaurantId || !slug || !expStr || !sig) return null;
  if (uid !== userId) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  const payload = `${uid}.${restaurantId}.${slug}.${expStr}`;
  const expected = await hmacSign(payload, secret);
  if (!timingSafeEqualString(expected, sig)) return null;

  return { userId: uid, restaurantId, slug, exp };
}

export async function readSupportSessionFromRequest(
  request: NextRequest,
  userId: string
): Promise<PlatformSupportSession | null> {
  return verifyPlatformSupportToken(
    request.cookies.get(PLATFORM_SUPPORT_COOKIE)?.value,
    userId
  );
}

export function applySupportCookie(
  response: NextResponse,
  token: string,
  maxAgeSec = DEFAULT_TTL_SEC
): void {
  response.cookies.set(PLATFORM_SUPPORT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  });
}

export function clearSupportCookie(response: NextResponse): void {
  response.cookies.set(PLATFORM_SUPPORT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
