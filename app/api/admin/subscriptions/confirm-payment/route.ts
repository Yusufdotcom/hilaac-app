import { NextResponse } from "next/server";

/**
 * POST /api/admin/subscriptions/confirm-payment
 * Retired: owners must not self-confirm SaaS payments.
 * Use platform Super Admin confirmation:
 *   POST /api/platform/renewals/[id]/confirm
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Owner self-confirm is disabled. Pay via USSD, then wait for Hilaac to confirm on the Platform dashboard.",
      code: "owner_self_confirm_retired",
    },
    { status: 410 }
  );
}
