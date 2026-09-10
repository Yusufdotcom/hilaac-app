/**
 * Staff PIN hashing (Node-only — scrypt).
 * Format: scrypt$N$r$p$saltB64$urlsafeHashB64
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export function isValidStaffPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export function hashStaffPin(pin: string): string {
  if (!isValidStaffPin(pin)) {
    throw new Error("PIN must be 4–6 digits");
  }
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyStaffPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !isValidStaffPin(pin)) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltB64 = parts[4];
  const hashB64 = parts[5];
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !saltB64 || !hashB64) {
    return false;
  }
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const actual = scryptSync(pin, salt, expected.length, { N: n, r, p });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
