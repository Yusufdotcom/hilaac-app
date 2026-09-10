import type { OrderStatus, OrderType, PaymentStatus } from "@/types/database";

const ACCEPTABLE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

/** Ignore stale tickets older than this in the Accept queue (hours). */
export const ACCEPT_QUEUE_MAX_AGE_HOURS = 24;

/**
 * Orders that still need a physical presence check before kitchen cooks.
 *
 * Accept queue:
 * - Dine-in QR: always, until `accepted_at` is set.
 * - Takeaway already paid (EVC/eDahab): skip — payment proves intent; auto-accept on pay.
 * - Manual POS: skipped at create (`accepted_at` set immediately).
 * - Takeaway unpaid cash: skip Accept — cashier Confirm Payment at pickup is the presence check.
 */
export function isAwaitingAcceptance(order: {
  status: OrderStatus;
  accepted_at?: string | null;
  order_type?: OrderType | string | null;
  payment_status?: PaymentStatus | string | null;
  created_at?: string;
}) {
  if (!ACCEPTABLE_STATUSES.includes(order.status) || order.accepted_at) {
    return false;
  }

  // Takeaway: no Accept checkpoint — paid online auto-accepts; cash uses Confirm Payment.
  if (order.order_type === "takeaway") {
    return false;
  }

  return true;
}

export function filterAwaitingAcceptance<
  T extends {
    status: OrderStatus;
    accepted_at?: string | null;
    order_type?: OrderType | string | null;
    payment_status?: PaymentStatus | string | null;
    created_at: string;
  },
>(orders: T[], maxAgeHours = ACCEPT_QUEUE_MAX_AGE_HOURS) {
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  return [...orders]
    .filter((o) => {
      if (!isAwaitingAcceptance(o)) return false;
      // Drop months-old stuck tickets so Kitchen never gets mysterious backlog accepts.
      const created = new Date(o.created_at).getTime();
      if (Number.isFinite(created) && created < cutoff) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
