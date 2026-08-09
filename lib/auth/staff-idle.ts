import { roleRequiresMfa } from "@/lib/auth/roles";

/** Owner/manager — shorter idle (revenue / payment settings access). */
export const DEFAULT_PRIVILEGED_IDLE_TIMEOUT_MINUTES = 18;

/** Kitchen / waiter / cashier — longer idle (shared devices, quiet periods). */
export const DEFAULT_FLOOR_IDLE_TIMEOUT_MINUTES = 60;

/** Warn this many ms before logout (toast). */
export const STAFF_IDLE_WARN_MS = 60_000;

function clampMinutes(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 240) return fallback;
  return Math.floor(minutes);
}

/**
 * Idle timeout by role (same split as MFA).
 * Optional envs override each band; NEXT_PUBLIC_STAFF_IDLE_TIMEOUT_MINUTES
 * still forces one value for all roles when set (escape hatch).
 */
export function getStaffIdleTimeoutMs(role?: string | null): number {
  const globalOverride = process.env.NEXT_PUBLIC_STAFF_IDLE_TIMEOUT_MINUTES?.trim();
  if (globalOverride) {
    return clampMinutes(globalOverride, DEFAULT_PRIVILEGED_IDLE_TIMEOUT_MINUTES) * 60_000;
  }

  const privileged = roleRequiresMfa(role);
  const envKey = privileged
    ? "NEXT_PUBLIC_STAFF_IDLE_PRIVILEGED_MINUTES"
    : "NEXT_PUBLIC_STAFF_IDLE_FLOOR_MINUTES";
  const fallback = privileged
    ? DEFAULT_PRIVILEGED_IDLE_TIMEOUT_MINUTES
    : DEFAULT_FLOOR_IDLE_TIMEOUT_MINUTES;

  return clampMinutes(process.env[envKey]?.trim(), fallback) * 60_000;
}
