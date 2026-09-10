/**
 * Deyn (credit ledger) helpers — codes are unique globally but always
 * validated against restaurant_id on lookup.
 */

export type DeynAccountRow = {
  id: string;
  restaurant_id: string;
  customer_name: string;
  customer_phone: string;
  deyn_code: string;
  credit_limit: number;
  balance: number;
  is_active: boolean;
};

export type DeynValidateOk = {
  ok: true;
  account: DeynAccountRow;
  remainingAfter: number;
  available: number;
};

export type DeynValidateErr = {
  ok: false;
  error: string;
  code: "not_found" | "inactive" | "insufficient";
  available?: number;
  needed?: number;
};

export function normalizeDeynCode(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

/** 8-char A-Z0-9 (excludes ambiguous 0/O/1/I for readability where easy). */
export function generateDeynCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}

export function availableCredit(account: Pick<DeynAccountRow, "credit_limit" | "balance">): number {
  return Math.max(0, Number(account.credit_limit) - Number(account.balance));
}

export function validateDeynForOrder(
  account: DeynAccountRow | null,
  restaurantId: string,
  orderTotal: number
): DeynValidateOk | DeynValidateErr {
  if (!account || account.restaurant_id !== restaurantId) {
    return { ok: false, error: "Code not found", code: "not_found" };
  }
  if (!account.is_active) {
    return { ok: false, error: "This Deyn account is inactive", code: "inactive" };
  }
  const available = availableCredit(account);
  const needed = Math.max(0, Number(orderTotal) || 0);
  if (needed > available + 1e-9) {
    return {
      ok: false,
      error: `Insufficient credit ($${available.toFixed(2)} available, $${needed.toFixed(2)} needed)`,
      code: "insufficient",
      available,
      needed,
    };
  }
  return {
    ok: true,
    account,
    available,
    remainingAfter: Math.round((available - needed) * 100) / 100,
  };
}
