/** Payment is submitted but awaiting cashier verification — never auto-recorded as paid. */
export const PENDING_CASHIER_CONFIRMATION = "pending_cashier_confirmation" as const;

export function mapProviderSuccessToPaymentStatus(
  providerSucceeded: boolean
): "pending_cashier_confirmation" | "failed" {
  return providerSucceeded ? PENDING_CASHIER_CONFIRMATION : "failed";
}
