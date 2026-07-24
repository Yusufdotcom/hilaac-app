import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Human-readable order label, e.g. "Order #102" or fallback to short id for legacy rows. */
export function formatOrderLabel(
  order: { id: string; order_number?: number | null },
  options?: { prefix?: boolean }
) {
  const hash =
    order.order_number != null ? `#${order.order_number}` : `#${order.id.substring(0, 8)}`;
  return options?.prefix === false ? hash : `Order ${hash}`;
}

/** Display customer phone with optional +252 prefix for local numbers. */
export function formatCustomerPhone(phone: string | null | undefined) {
  if (!phone?.trim()) return null;
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("252")) return `+${trimmed}`;
  if (trimmed.startsWith("0")) return `+252${trimmed.slice(1)}`;
  return trimmed;
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Alias used when creating branch slugs from a display name. */
export const generateSlug = slugify;

export function daysUntil(date: string | Date) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
