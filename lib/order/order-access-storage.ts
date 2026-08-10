/**
 * Browser storage for order-scoped access tokens (track / confirm).
 *
 * - accessToken → localStorage (+ sessionStorage mirror) so status survives
 *   tab/browser close for the token's HMAC lifetime (ORDER_ACCESS_TTL_SEC).
 * - chargeToken → sessionStorage only (short-lived payment capability).
 * Never put tokens in shareable URLs.
 */
const ACCESS_PREFIX = "hilaac-order-access:";
const CHARGE_PREFIX = "hilaac-order-charge:";

function canUseStorage() {
  return typeof window !== "undefined";
}

/** Parse exp from `orderId.restaurantId.exp.sig` without verifying signature. */
export function peekTokenExpirySec(token: string | null | undefined): number | null {
  if (!token?.trim()) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 4) return null;
  const exp = Number(parts[2]);
  return Number.isFinite(exp) ? exp : null;
}

function isTokenExpiredClient(token: string | null | undefined): boolean {
  const exp = peekTokenExpirySec(token);
  if (exp == null) return true;
  return exp < Math.floor(Date.now() / 1000);
}

function readAccessRaw(orderId: string): string | null {
  try {
    return (
      sessionStorage.getItem(`${ACCESS_PREFIX}${orderId}`) ??
      localStorage.getItem(`${ACCESS_PREFIX}${orderId}`)
    );
  } catch {
    return null;
  }
}

function clearAccess(orderId: string) {
  try {
    sessionStorage.removeItem(`${ACCESS_PREFIX}${orderId}`);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(`${ACCESS_PREFIX}${orderId}`);
  } catch {
    /* ignore */
  }
}

export function saveOrderTokens(
  orderId: string,
  tokens: { accessToken?: string | null; chargeToken?: string | null }
) {
  if (!canUseStorage() || !orderId) return;
  try {
    if (tokens.accessToken) {
      sessionStorage.setItem(`${ACCESS_PREFIX}${orderId}`, tokens.accessToken);
      try {
        localStorage.setItem(`${ACCESS_PREFIX}${orderId}`, tokens.accessToken);
      } catch {
        // private mode / quota — sessionStorage still helps same tab
      }
    }
    if (tokens.chargeToken) {
      sessionStorage.setItem(`${CHARGE_PREFIX}${orderId}`, tokens.chargeToken);
    }
  } catch {
    // ignore quota / private mode
  }
}

/** Prefer long-lived access token; never return an expired charge fallback. */
export function loadOrderAccessToken(orderId: string): string | null {
  if (!canUseStorage() || !orderId) return null;
  try {
    const access = readAccessRaw(orderId);
    if (access && !isTokenExpiredClient(access)) return access;
    if (access) clearAccess(orderId);

    // Charge token is payment-scoped (15m). Only use if still valid.
    const charge = sessionStorage.getItem(`${CHARGE_PREFIX}${orderId}`);
    if (charge && !isTokenExpiredClient(charge)) return charge;
    return null;
  } catch {
    return null;
  }
}

export function loadOrderChargeToken(orderId: string): string | null {
  if (!canUseStorage() || !orderId) return null;
  try {
    const charge = sessionStorage.getItem(`${CHARGE_PREFIX}${orderId}`);
    if (charge && !isTokenExpiredClient(charge)) return charge;
    const access = readAccessRaw(orderId);
    if (access && !isTokenExpiredClient(access)) return access;
    return null;
  } catch {
    return null;
  }
}
