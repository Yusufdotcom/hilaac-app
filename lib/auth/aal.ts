import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { roleRequiresMfa } from "@/lib/auth/roles";

export type AalGateResult =
  | { ok: true; aal: "aal1" | "aal2" | null }
  | { ok: false; response: NextResponse };

/**
 * For owner/manager, require current session AAL2 before sensitive actions.
 * Staff roles are not subject to this gate (they never reach these APIs by role).
 */
export async function requireAal2ForPrivilegedRole(
  supabase: SupabaseClient,
  role: string | null | undefined
): Promise<AalGateResult> {
  if (!roleRequiresMfa(role)) {
    return { ok: true, aal: null };
  }

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Could not verify multi-factor status", code: "aal_check_failed" },
        { status: 403 }
      ),
    };
  }

  const current = data.currentLevel;
  if (current !== "aal2") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Two-factor authentication required for this action",
          code: "aal2_required",
          currentLevel: current,
          nextLevel: data.nextLevel,
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, aal: "aal2" };
}

/** Payment / merchant credential fields that require AAL2 to change. */
export const PAYMENT_SENSITIVE_BODY_KEYS = [
  "payment_mode",
  "evc_ussd_code",
  "edahab_ussd_code",
  "evc_merchant_id",
  "evc_api_key",
  "edahab_merchant_id",
  "edahab_api_key",
] as const;

export function bodyTouchesPaymentSettings(body: Record<string, unknown>): boolean {
  return PAYMENT_SENSITIVE_BODY_KEYS.some((k) => k in body);
}
