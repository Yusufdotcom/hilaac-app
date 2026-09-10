import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Display currency config — set once from admin shell / order brand. Amounts in DB stay USD. */
export type CurrencyDisplay = {
  code: "USD" | "SOS";
  /** SOS per 1 USD when code is SOS */
  rate: number;
};

let currencyDisplay: CurrencyDisplay = { code: "USD", rate: 1 };

export function configureCurrencyDisplay(next: CurrencyDisplay) {
  currencyDisplay = {
    code: next.code === "SOS" ? "SOS" : "USD",
    rate: Number.isFinite(next.rate) && next.rate > 0 ? next.rate : 1,
  };
}

export function getCurrencyDisplay(): CurrencyDisplay {
  return currencyDisplay;
}

/**
 * Format a stored USD amount for display.
 * When currency is SOS, multiplies by the configured rate.
 */
export function formatCurrency(amount: number) {
  const n = Number(amount) || 0;
  if (currencyDisplay.code === "SOS") {
    const sos = Math.round(n * currencyDisplay.rate);
    return `SOS ${sos.toLocaleString("en-US")}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
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
