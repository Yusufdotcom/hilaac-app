import { createClient } from "@/lib/supabase/server";
import { verifyChargeToken } from "@/lib/payments/charge-token";

export type OrderAccessOk = {
  ok: true;
  restaurantId: string;
  via: "order_token" | "staff";
};

export type OrderAccessFail = {
  ok: false;
  status: 401 | 403 | 503;
  error: string;
  reason: string;
};

const STAFF_ROLES = ["owner", "manager", "cashier"] as const;

/**
 * Authorize customer order APIs (charge / confirm-payment / track).
 * Accepts a short-lived HMAC order token, or a staff session for the
 * order's restaurant (cashier manual confirm, staff status views).
 */
export async function authorizeOrderAccess(options: {
  orderId: string;
  token: string | null;
}): Promise<OrderAccessOk | OrderAccessFail> {
  const tokenResult = verifyChargeToken(options.token, { orderId: options.orderId });

  if (tokenResult.ok) {
    return {
      ok: true,
      restaurantId: tokenResult.claims.restaurantId,
      via: "order_token",
    };
  }

  if (tokenResult.reason === "secret_not_configured") {
    console.error("[orders] CHARGE_TOKEN_SECRET is not configured");
    return {
      ok: false,
      status: 503,
      error: "Order access is not configured",
      reason: tokenResult.reason,
    };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, status: 401, error: "Unauthorized", reason: tokenResult.reason };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_id, role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (
      !profile?.restaurant_id ||
      profile.is_active === false ||
      !STAFF_ROLES.includes(profile.role as (typeof STAFF_ROLES)[number])
    ) {
      return { ok: false, status: 403, error: "Forbidden", reason: "staff_role" };
    }

    return {
      ok: true,
      restaurantId: profile.restaurant_id,
      via: "staff",
    };
  } catch {
    return { ok: false, status: 401, error: "Unauthorized", reason: tokenResult.reason };
  }
}

/** Extract Bearer token or body/query token fields. */
export function extractOrderAccessToken(req: Request, bodyToken?: string | null): string | null {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) return bearer;
  if (bodyToken?.trim()) return bodyToken.trim();
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("accessToken") ?? url.searchParams.get("chargeToken");
    if (q?.trim()) return q.trim();
  } catch {
    // ignore
  }
  return null;
}
