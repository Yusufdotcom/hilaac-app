import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

/** HttpOnly cookie: platform admin is viewing a tenant admin console. */
export const PLATFORM_SUPPORT_COOKIE = "hilaac_platform_support";

const DEFAULT_TTL_SEC = 8 * 60 * 60;

export type PlatformSupportSession = {
  restaurantId: string;
  slug: string;
  userId: string;
  exp: number;
};

function getSecret(): string {
  const secret =
    process.env.PLATFORM_SUPPORT_SECRET?.trim() ||
    process.env.CHARGE_TOKEN_SECRET?.trim() ||
    process.env.ENCRYPTION_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("PLATFORM_SUPPORT_SECRET (or CHARGE_TOKEN_SECRET) is not set");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Mint a user-bound support token for tenant Open. */
export function mintPlatformSupportToken(
  userId: string,
  restaurantId: string,
  slug: string,
  ttlSec = DEFAULT_TTL_SEC
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${userId}.${restaurantId}.${slug}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyPlatformSupportToken(
  token: string | undefined | null,
  userId: string
): PlatformSupportSession | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [uid, restaurantId, slug, expStr, sig] = parts;
  if (!uid || !restaurantId || !slug || !expStr || !sig) return null;
  if (uid !== userId) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const payload = `${uid}.${restaurantId}.${slug}.${expStr}`;
  if (!safeEqual(sign(payload), sig)) return null;
  return { userId: uid, restaurantId, slug, exp };
}

export function readSupportSessionFromRequest(
  request: NextRequest,
  userId: string
): PlatformSupportSession | null {
  return verifyPlatformSupportToken(
    request.cookies.get(PLATFORM_SUPPORT_COOKIE)?.value,
    userId
  );
}

export function readSupportSessionForUser(userId: string): PlatformSupportSession | null {
  try {
    const jar = cookies();
    return verifyPlatformSupportToken(jar.get(PLATFORM_SUPPORT_COOKIE)?.value, userId);
  } catch {
    return null;
  }
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
