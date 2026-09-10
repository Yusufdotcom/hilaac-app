/** Theme-aware status / payment pill classes (admin light + dark). */

export const ORDER_STATUS_PILL: Record<string, string> = {
  awaiting_payment: "admin-pill-orange border-0",
  new: "admin-pill-blue border-0",
  preparing: "admin-pill-amber border-0",
  ready: "admin-pill-emerald border-0",
  delivered: "admin-pill-violet border-0",
  completed: "admin-pill-emerald border-0",
  cancelled: "admin-pill-red border-0",
};

export const PAYMENT_STATUS_PILL: Record<string, string> = {
  paid: "admin-pill-emerald border-0",
  pending: "admin-pill-slate border-0",
  pending_cashier_confirmation: "admin-pill-amber border-0",
  failed: "admin-pill-red border-0",
};

export const LIVE_PILL = "admin-pill-live border-0";

export function orderStatusPill(status: string | null | undefined): string {
  if (!status) return "admin-pill-slate border-0";
  return ORDER_STATUS_PILL[status] ?? "admin-pill-slate border-0";
}

export function paymentStatusPill(status: string | null | undefined): string {
  if (!status) return "admin-pill-slate border-0";
  return PAYMENT_STATUS_PILL[status] ?? "admin-pill-slate border-0";
}
