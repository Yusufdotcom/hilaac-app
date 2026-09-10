import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  normalizeDeynCode,
  validateDeynForOrder,
  type DeynAccountRow,
} from "@/lib/deyn/codes";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/deyn/validate
 * Live Deyn-code check for QR checkout (no auth). Always scoped to restaurant_id.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const restaurantId = String(body.restaurant_id ?? "").trim();
  const code = normalizeDeynCode(String(body.code ?? ""));
  const orderTotal = Number(body.order_total ?? 0) || 0;

  if (!restaurantId || code.length !== 8) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid 8-character Deyn code", code: "not_found" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("deyn_accounts")
    .select("*")
    .eq("deyn_code", code)
    .maybeSingle();

  const result = validateDeynForOrder(
    (account as DeynAccountRow | null) ?? null,
    restaurantId,
    orderTotal
  );

  if (!result.ok) {
    return NextResponse.json(result);
  }

  return NextResponse.json({
    ok: true,
    customer_name: result.account.customer_name,
    deyn_code: result.account.deyn_code,
    available: result.available,
    remaining_after: result.remainingAfter,
    credit_limit: Number(result.account.credit_limit),
    balance: Number(result.account.balance),
  });
}
