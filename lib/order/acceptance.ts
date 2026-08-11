import type { OrderStatus } from "@/types/database";

const ACCEPTABLE_STATUSES: OrderStatus[] = ["new", "preparing", "ready"];

/** Orders that still need a physical presence check before kitchen cooks. */
export function isAwaitingAcceptance(order: {
  status: OrderStatus;
  accepted_at?: string | null;
}) {
  return ACCEPTABLE_STATUSES.includes(order.status) && !order.accepted_at;
}

export function filterAwaitingAcceptance<
  T extends { status: OrderStatus; accepted_at?: string | null; created_at: string },
>(orders: T[]) {
  return [...orders]
    .filter(isAwaitingAcceptance)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
