const STORAGE_KEY = "hilaac-offline-orders";
const CREATE_ORDER_API = "/api/orders/create";

/** Full body expected by POST /api/orders/create */
export interface CreateOrderApiPayload {
  restaurantId: string;
  tableId: string | null;
  orderType: "dine-in" | "takeaway";
  paymentMethod?: "evc" | "edahab" | null;
  billingModel?: "pay_before" | "pay_after";
  customerPhone?: string | null;
  notes?: string | null;
  items: {
    menuItemId: string;
    quantity: number;
    addOnIds: string[];
    notes?: string;
  }[];
}

/**
 * Queued order stored in localStorage while offline.
 * Always includes the full API payload so sync never touches Supabase directly.
 */
export interface QueuedOrder {
  id: string;
  synced: boolean;
  queuedAt: string;
  slug: string;
  /** Full POST body for /api/orders/create */
  payload: CreateOrderApiPayload;
  /** Client-side id used for the status page before/after sync */
  localOrderId: string;
  /** When true, confirm payment via API after order is created on sync */
  confirmPayment?: boolean;
  /** Set when the order was already created server-side before going offline */
  serverOrderId?: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readQueue(): QueuedOrder[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOrder[]) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

/**
 * Saves an order to localStorage with `synced: false`.
 */
export function queueOrder(
  order: Omit<QueuedOrder, "synced" | "queuedAt"> & { queuedAt?: string }
) {
  if (!isBrowser()) return;

  const entry: QueuedOrder = {
    ...order,
    synced: false,
    queuedAt: order.queuedAt ?? new Date().toISOString(),
  };

  writeQueue([...readQueue(), entry]);
}

/** Returns all orders currently stored in localStorage. */
export function getQueue(): QueuedOrder[] {
  return readQueue();
}

/** Whether an order id is still waiting to sync from the offline queue. */
export function isOrderPendingSync(orderId: string): boolean {
  return readQueue().some(
    (item) =>
      !item.synced &&
      (item.localOrderId === orderId || item.serverOrderId === orderId)
  );
}

/** Removes queue entries matching the given order id (local or server). */
export function removeQueuedOrderByOrderId(orderId: string) {
  writeQueue(
    readQueue().filter(
      (item) => item.localOrderId !== orderId && item.serverOrderId !== orderId
    )
  );
}

function markSynced(queueId: string) {
  const queue = readQueue();
  writeQueue(
    queue
      .map((item) => (item.id === queueId ? { ...item, synced: true } : item))
      .filter((item) => !item.synced)
  );
}

async function confirmPaymentViaApi(orderId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/orders/${orderId}/confirm-payment`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

async function createOrderViaApi(payload: CreateOrderApiPayload): Promise<string | null> {
  try {
    const res = await fetch(CREATE_ORDER_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { orderId?: string };
    return data.orderId ?? null;
  } catch {
    return null;
  }
}

/**
 * Syncs all unsynced queued orders through server API routes (never Supabase client).
 * - Creates orders via POST /api/orders/create
 * - Records customer payment intent via POST /api/orders/[id]/confirm-payment when needed
 * Successfully synced entries are marked and removed from the queue.
 */
export async function syncOfflineOrders(): Promise<{ synced: number; failed: number }> {
  if (!isBrowser() || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const pending = readQueue().filter((item) => !item.synced);
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      let orderId = item.serverOrderId ?? null;
      let success = false;

      if (orderId) {
        if (item.confirmPayment) {
          success = await confirmPaymentViaApi(orderId);
        } else {
          success = true;
        }
      } else {
        orderId = await createOrderViaApi(item.payload);
        if (orderId) {
          if (item.confirmPayment) {
            success = await confirmPaymentViaApi(orderId);
          } else {
            success = true;
          }
        }
      }

      if (success) {
        markSynced(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

/** Generates a unique id for queue entries. */
export function createQueueId() {
  if (isBrowser() && typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
