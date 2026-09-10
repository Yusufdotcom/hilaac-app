import type { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/types/database";

/**
 * Signed staff-PIN session cookie (Edge-safe Web Crypto).
 * Grants floor-role staff dashboards only — never /admin.
 */

export const STAFF_PIN_COOKIE = "hilaac_staff_pin";
export const STAFF_PIN_TTL_SEC = 8 * 60 * 60;

export const PIN_ELIGIBLE_ROLES: UserRole[] = ["kitchen", "waiter", "cashier"];

export type StaffPinSession = {
  profileId: string;
  restaurantId: string;
  slug: string;
  role: UserRole;
  fullName: string;
  exp: number;
};

function getSecretOrNull(): string | null {
  const secret =
    process.env.STAFF_PIN_SECRET?.trim() ||
    process.env.PLATFORM_SUPPORT_SECRET?.trim() ||
    process.env.CHARGE_TOKEN_SECRET?.trim() ||
    process.env.ENCRYPTION_SECRET_KEY?.trim();
  return secret || null;
}

function requireSecret(): string {
  const secret = getSecretOrNull();
  if (!secret) {
    throw new Error("STAFF_PIN_SECRET (or CHARGE_TOKEN_SECRET) is not set");
  }
  return secret;
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
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

function encodeName(name: string): string {
  return encodeURIComponent(name.slice(0, 80));
}

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "Staff";
  }
}

export function isPinEligibleRole(role: string | null | undefined): role is UserRole {
  return role === "kitchen" || role === "waiter" || role === "cashier";
}

export async function mintStaffPinToken(
  session: Omit<StaffPinSession, "exp">,
  ttlSec = STAFF_PIN_TTL_SEC
): Promise<string> {
  const secret = requireSecret();
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${session.profileId}.${session.restaurantId}.${session.slug}.${session.role}.${encodeName(session.fullName)}.${exp}`;
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyStaffPinToken(
  token: string | undefined | null
): Promise<StaffPinSession | null> {
  if (!token) return null;
  const secret = getSecretOrNull();
  if (!secret) return null;

  const parts = token.split(".");
  // profileId.restaurantId.slug.role.name.exp.sig  — name is URI-encoded (no dots)
  if (parts.length !== 7) return null;
  const [profileId, restaurantId, slug, role, nameEnc, expStr, sig] = parts;
  if (!profileId || !restaurantId || !slug || !role || !nameEnc || !expStr || !sig) return null;
  if (!isPinEligibleRole(role)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  const payload = `${profileId}.${restaurantId}.${slug}.${role}.${nameEnc}.${expStr}`;
  const expected = await hmacSign(payload, secret);
  if (!timingSafeEqualString(expected, sig)) return null;

  return {
    profileId,
    restaurantId,
    slug,
    role,
    fullName: decodeName(nameEnc),
    exp,
  };
}

export async function readStaffPinSessionFromRequest(
  request: NextRequest
): Promise<StaffPinSession | null> {
  return verifyStaffPinToken(request.cookies.get(STAFF_PIN_COOKIE)?.value);
}

export function applyStaffPinCookie(
  response: NextResponse,
  token: string,
  maxAgeSec = STAFF_PIN_TTL_SEC
): void {
  response.cookies.set(STAFF_PIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  });
}

export function clearStaffPinCookie(response: NextResponse): void {
  response.cookies.set(STAFF_PIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
