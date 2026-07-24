import type { PaymentStatus } from "@/types/database";

/** Payment is submitted but awaiting cashier verification — never auto-recorded as paid. */
export const PENDING_CASHIER_CONFIRMATION = "pending_cashier_confirmation" as const;

/** payment_status written when customer/provider submitted payment but cashier has not verified yet. */
export function paymentStatusAwaitingCashierWrite(): typeof PENDING_CASHIER_CONFIRMATION {
  return PENDING_CASHIER_CONFIRMATION;
}

/** True when payment is submitted and waiting for cashier to mark paid. */
export function isAwaitingCashierConfirmation(order: {
  payment_status: string;
  customer_confirmed_at?: string | null;
}): boolean {
  return (
    order.payment_status === PENDING_CASHIER_CONFIRMATION ||
    // Legacy rows created before ENUM migration used pending + customer_confirmed_at
    (order.payment_status === "pending" && !!order.customer_confirmed_at)
  );
}

export function mapProviderSuccessToPaymentStatus(
  providerSucceeded: boolean
): Extract<PaymentStatus, "pending_cashier_confirmation" | "failed"> {
  return providerSucceeded ? PENDING_CASHIER_CONFIRMATION : "failed";
}
