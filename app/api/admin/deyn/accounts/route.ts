import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { generateDeynCode, normalizeDeynCode } from "@/lib/deyn/codes";
import { sendWhatsAppText } from "@/lib/whatsapp/twilio";
import { toWhatsAppAddress } from "@/lib/whatsapp/phone";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function loadRestaurant(restaurantId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurants")
    .select("id, name, subscription_tier")
    .eq("id", restaurantId)
    .maybeSingle();
  return data;
}

/** GET /api/admin/deyn/accounts */
export async function GET() {
  const auth = await requireActiveStaff({ roles: ["owner", "manager", "cashier"] });
  if (!auth.ok) return auth.response;

  const restaurant = await loadRestaurant(auth.profile.restaurant_id!);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "deyn_ledger")) {
    return NextResponse.json({ error: "Feature gated", gated: true }, { status: 403 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("deyn_accounts")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data ?? [] });
}

/** POST /api/admin/deyn/accounts — create + WhatsApp code */
export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const restaurant = await loadRestaurant(auth.profile.restaurant_id!);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "deyn_ledger")) {
    return NextResponse.json({ error: "Feature gated", gated: true }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const customerName = String(body.customer_name ?? "").trim();
  const customerPhone = String(body.customer_phone ?? "").trim();
  const creditLimit = Number(body.credit_limit);
  if (!customerName || !customerPhone || !(creditLimit >= 0)) {
    return NextResponse.json(
      { error: "customer_name, customer_phone, and credit_limit are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  let deynCode = normalizeDeynCode(String(body.deyn_code ?? "")) || generateDeynCode();
  let account = null;
  let lastError = "";

  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) deynCode = generateDeynCode();
    const { data, error } = await admin
      .from("deyn_accounts")
      .insert({
        restaurant_id: restaurant.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        deyn_code: deynCode,
        credit_limit: creditLimit,
        balance: 0,
        is_active: true,
        created_by: auth.user.id,
      })
      .select("*")
      .single();

    if (!error && data) {
      account = data;
      break;
    }
    lastError = error?.message ?? "insert failed";
    if (!lastError.includes("deyn_accounts_code_unique") && !lastError.includes("duplicate")) {
      return NextResponse.json({ error: lastError }, { status: 400 });
    }
  }

  if (!account) {
    return NextResponse.json({ error: lastError || "Could not allocate Deyn code" }, { status: 500 });
  }

  const to = toWhatsAppAddress(customerPhone);
  if (to) {
    await sendWhatsAppText({
      toWhatsApp: to,
      body: [
        `Your Deyn account at ${restaurant.name} is ready.`,
        `Code: ${account.deyn_code}.`,
        `Credit limit: ${formatCurrency(Number(account.credit_limit))}.`,
        `Use this code at checkout when ordering.`,
      ].join(" "),
    });
  }

  return NextResponse.json({ account }, { status: 201 });
}
