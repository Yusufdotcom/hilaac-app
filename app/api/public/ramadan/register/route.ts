import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function generatePassCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/**
 * POST /api/public/ramadan/register
 * Public registration — service role insert; payment_status paid for v1 flow.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug ?? "").trim();
  const packageId = String(body.package_id ?? "").trim();
  const customerName = String(body.customer_name ?? "").trim();
  const customerPhone = String(body.customer_phone ?? "").trim();

  if (!slug || !packageId || !customerName || !customerPhone) {
    return NextResponse.json(
      { error: "slug, package_id, customer_name, and customer_phone are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, subscription_tier, active_season, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant || restaurant.is_active === false) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "ramadan_packages")) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  if (!restaurant.active_season) {
    return NextResponse.json({ error: "Season mode is not enabled" }, { status: 400 });
  }

  const { data: pkg } = await admin
    .from("ramadan_packages")
    .select("id, restaurant_id, price, is_active, season, valid_from, valid_to")
    .eq("id", packageId)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  if (!pkg || !pkg.is_active) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }
  if (pkg.season !== restaurant.active_season) {
    return NextResponse.json({ error: "Package is not available for the current season" }, { status: 400 });
  }

  let passCode = generatePassCode();
  let subscription = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from("ramadan_subscriptions")
      .insert({
        package_id: pkg.id,
        restaurant_id: restaurant.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        pass_code: passCode,
        payment_status: "paid",
        payment_amount: Number(pkg.price) || 0,
      })
      .select("id, pass_code, payment_status, customer_name")
      .single();

    if (!error && data) {
      subscription = data;
      break;
    }
    lastError = error?.message ?? "Insert failed";
    if (error?.code === "23505") {
      passCode = generatePassCode();
      continue;
    }
    return NextResponse.json({ error: lastError }, { status: 500 });
  }

  if (!subscription) {
    return NextResponse.json({ error: lastError ?? "Could not create subscription" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    subscription: {
      id: subscription.id,
      pass_code: subscription.pass_code,
      payment_status: subscription.payment_status,
      customer_name: subscription.customer_name,
    },
  });
}
