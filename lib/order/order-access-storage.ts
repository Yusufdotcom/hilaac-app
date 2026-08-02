/**
 * Browser storage for order-scoped access tokens (track / confirm).
 * Prefer sessionStorage so tokens die with the tab; never put in URLs.
 */
const ACCESS_PREFIX = "hilaac-order-access:";
const CHARGE_PREFIX = "hilaac-order-charge:";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function saveOrderTokens(
  orderId: string,
  tokens: { accessToken?: string | null; chargeToken?: string | null }
) {
  if (!canUseStorage() || !orderId) return;
  try {
    if (tokens.accessToken) {
      sessionStorage.setItem(`${ACCESS_PREFIX}${orderId}`, tokens.accessToken);
    }
    if (tokens.chargeToken) {
      sessionStorage.setItem(`${CHARGE_PREFIX}${orderId}`, tokens.chargeToken);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function loadOrderAccessToken(orderId: string): string | null {
  if (!canUseStorage() || !orderId) return null;
  try {
    return (
      sessionStorage.getItem(`${ACCESS_PREFIX}${orderId}`) ??
      sessionStorage.getItem(`${CHARGE_PREFIX}${orderId}`)
    );
  } catch {
    return null;
  }
}

export function loadOrderChargeToken(orderId: string): string | null {
  if (!canUseStorage() || !orderId) return null;
  try {
    return (
      sessionStorage.getItem(`${CHARGE_PREFIX}${orderId}`) ??
      sessionStorage.getItem(`${ACCESS_PREFIX}${orderId}`)
    );
  } catch {
    return null;
  }
}
