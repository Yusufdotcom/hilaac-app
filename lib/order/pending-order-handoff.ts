import type { CreateOrderApiPayload } from "@/lib/offline-queue";
import { saveOrderTokens } from "@/lib/order/order-access-storage";

const STORAGE_PREFIX = "hilaac-pending-order:";
const RESOLVED_PREFIX = "hilaac-resolved-order:";

/** Guaranteed navigation to status even when create is still in flight. */
export const ORDER_REDIRECT_DELAY_MS = 3_000;
/** Show Retry on the loading UI if create still hasn't completed. */
export const ORDER_CREATE_TIMEOUT_MS = 5_000;
export const ORDER_POLL_INTERVAL_MS = 2_000;

export type PendingOrderHandoff = {
  tempId: string;
  slug: string;
  payload: CreateOrderApiPayload;
  confirmPayment?: boolean;
  createdAt: number;
};

function storageKey(tempId: string) {
  return `${STORAGE_PREFIX}${tempId}`;
}

function resolvedKey(tempId: string) {
  return `${RESOLVED_PREFIX}${tempId}`;
}

export function createTempOrderId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function savePendingOrderHandoff(handoff: PendingOrderHandoff) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(handoff.tempId), JSON.stringify(handoff));
  } catch {
    // sessionStorage may be unavailable — status page will still poll/retry.
  }
}

export function loadPendingOrderHandoff(tempId: string): PendingOrderHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(tempId));
    if (!raw) return null;
    return JSON.parse(raw) as PendingOrderHandoff;
  } catch {
    return null;
  }
}

export function clearPendingOrderHandoff(tempId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(tempId));
  } catch {
    // ignore
  }
}

export function saveResolvedOrderId(tempId: string, realOrderId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(resolvedKey(tempId), realOrderId);
  } catch {
    // ignore
  }
}

export function loadResolvedOrderId(tempId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(resolvedKey(tempId));
  } catch {
    return null;
  }
}

export function clearResolvedOrderId(tempId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(resolvedKey(tempId));
  } catch {
    // ignore
  }
}

/** Resolves a real server order id from a pending handoff (create + optional confirm). */
export async function fulfillPendingOrderHandoff(
  handoff: PendingOrderHandoff,
  options?: { signal?: AbortSignal }
): Promise<{ orderId: string }> {
  const res = await fetch("/api/orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(handoff.payload),
    signal: options?.signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.orderId) {
    throw new Error(data.error ?? "Failed to create order. Please try again.");
  }

  const orderId = data.orderId as string;
  const chargeToken = (data.chargeToken as string | null | undefined) ?? null;
  const accessToken = (data.accessToken as string | null | undefined) ?? null;
  saveOrderTokens(orderId, { chargeToken, accessToken });

  if (handoff.confirmPayment) {
    const token = accessToken ?? chargeToken;
    const confirmRes = await fetch(`/api/orders/${orderId}/confirm-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        accessToken: accessToken ?? undefined,
        chargeToken: chargeToken ?? undefined,
      }),
      signal: options?.signal,
    });
    if (!confirmRes.ok) {
      const confirmData = await confirmRes.json().catch(() => ({}));
      throw new Error(confirmData.error ?? "Order created but payment confirmation failed.");
    }
  }

  return { orderId };
}
