import type { OrderType } from "@/types/database";
import type { CartItem } from "@/lib/order/cart-types";

const PREFIX = "hilaac-order-draft:";
/** Drafts older than this are discarded on restore. */
export const DRAFT_TTL_MS = 4 * 60 * 60 * 1000;

export type OrderDraftStep = "landing" | "table" | "menu";

export type OrderDraft = {
  restaurantId: string;
  slug: string;
  step: OrderDraftStep;
  orderType: OrderType;
  tableNumber: string;
  cart: CartItem[];
  savedAt: number;
};

function key(slug: string) {
  return `${PREFIX}${slug}`;
}

export function saveOrderDraft(draft: OrderDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(draft.slug), JSON.stringify(draft));
  } catch {
    // private mode / quota
  }
}

export function clearOrderDraft(slug: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(slug));
  } catch {
    // ignore
  }
}

export function loadOrderDraft(
  slug: string,
  restaurantId: string
): OrderDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return null;
    const draft = JSON.parse(raw) as OrderDraft;
    if (!draft || draft.slug !== slug || draft.restaurantId !== restaurantId) {
      clearOrderDraft(slug);
      return null;
    }
    if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      clearOrderDraft(slug);
      return null;
    }
    if (!Array.isArray(draft.cart)) {
      clearOrderDraft(slug);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}
