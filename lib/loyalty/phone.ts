/**
 * Canonical loyalty phone key: digits only.
 * Leading 0 → 252 (Somalia). Matches SQL normalize_loyalty_phone.
 */
export function normalizeLoyaltyPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) {
    digits = `252${digits.slice(1)}`;
  }
  if (digits.length < 8) return null;
  return digits;
}
