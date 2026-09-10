import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { PLANS } from "@/lib/constants";
import { decrypt } from "@/lib/encryption";
import {
  parseRenewalIntent,
  renewalAmountForTier,
  resolveRenewalTier,
  type BillableTier,
} from "@/lib/platform/subscription-renewal";
import { ussdDialString } from "@/lib/platform/ussd";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/subscriptions/ussd?intent=renew|switch_goronyo|switch_gorgor|switch_galeyr|switch_somali_airlines
 * (Legacy intents upgrade_pro|switch_starter still accepted during migration.)
 * Returns Hilaac platform USSD dial strings for the owner's restaurant plan.
 * Does not expose restaurant customer merchant codes.
 */
export async function GET(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const intent = parseRenewalIntent(req.nextUrl.searchParams.get("intent") ?? "renew");

  const admin = createAdminClient();
  const { data: restaurant, error: restErr } = await admin
    .from("restaurants")
    .select("id, subscription_tier")
    .eq("id", auth.profile.restaurant_id)
    .maybeSingle();

  if (restErr || !restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const tier: BillableTier = resolveRenewalTier(restaurant.subscription_tier, intent);
  const amount = renewalAmountForTier(tier);

  const { data: settings } = await admin
    .from("platform_settings")
    .select("evc_ussd_code_encrypted, edahab_ussd_code_encrypted")
    .eq("id", 1)
    .maybeSingle();

  const evcBase = toDialBase(
    decrypt(settings?.evc_ussd_code_encrypted) ||
      process.env.NEXT_PUBLIC_HILAAC_EVC_USSD?.trim() ||
      "*712*9*"
  );
  const edahabBase = toDialBase(
    decrypt(settings?.edahab_ussd_code_encrypted) ||
      process.env.NEXT_PUBLIC_HILAAC_EDAHAB_USSD?.trim() ||
      "*888*9*"
  );

  return NextResponse.json({
    tier,
    amount,
    intent,
    priceLabel: PLANS[tier].priceLabel,
    planName: PLANS[tier].name,
    dial: {
      evc: ussdDialString(evcBase, amount),
      edahab: ussdDialString(edahabBase, amount),
    },
    codes: {
      evc: evcBase,
      edahab: edahabBase,
    },
  });
}

/** Normalize to a base USSD prefix (amount appended by ussdDialString). */
function toDialBase(code: string): string {
  let s = code.trim();
  // Strip trailing # and any trailing amount digits (legacy *712*9*79#)
  if (s.endsWith("#")) s = s.slice(0, -1);
  s = s.replace(/\d+$/, "");
  if (!s.endsWith("*")) s = `${s}*`;
  return s;
}
