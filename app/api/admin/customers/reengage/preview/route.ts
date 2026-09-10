import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { requireAal2ForPrivilegedRole } from "@/lib/auth/aal";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { HILAAC_AI_MODEL } from "@/lib/ai/model";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { assignCustomerSegment } from "@/lib/customers/customer-segments";
import { createAdminClient } from "@/lib/supabase/server";
import { getAppDayBounds } from "@/lib/time/app-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/customers/reengage/preview
 * Body: { customerPhone: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const aal = await requireAal2ForPrivilegedRole(auth.supabase, auth.profile.role);
  if (!aal.ok) return aal.response;

  const restaurantId = auth.profile.restaurant_id!;
  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, subscription_tier")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  if (!canUseFeature(restaurant.subscription_tier, "customer_intelligence")) {
    return NextResponse.json({ error: "Galeyr exclusive", gated: true }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { customerPhone?: string };
  const customerPhone = String(body.customerPhone ?? "").trim();
  if (!customerPhone) {
    return NextResponse.json({ error: "customerPhone required" }, { status: 400 });
  }

  const { data: profile } = await admin
    .from("customer_profiles")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("customer_phone", customerPhone)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { start: d30 } = getAppDayBounds(-29);
  const { end: todayEnd } = getAppDayBounds(0);
  const { count: visits30 } = await admin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("customer_phone", customerPhone)
    .eq("payment_status", "paid")
    .gte("created_at", d30.toISOString())
    .lt("created_at", todayEnd.toISOString());

  const segment = assignCustomerSegment({
    total_visits: Number(profile.total_visits) || 0,
    lifetime_spend: Number(profile.lifetime_spend) || 0,
    last_visit: profile.last_visit,
    first_visit: profile.first_visit,
    visits_last_30d: visits30 ?? 0,
  });

  if (segment !== "at_risk") {
    return NextResponse.json({ error: "Customer is not At-Risk" }, { status: 400 });
  }

  const daysSinceLast = Math.max(
    0,
    Math.floor((Date.now() - new Date(profile.last_visit).getTime()) / 86400000)
  );

  const { data: itemRows } = await admin
    .from("orders")
    .select("order_items(quantity, menu_item:menu_items(name))")
    .eq("restaurant_id", restaurantId)
    .eq("customer_phone", customerPhone)
    .eq("payment_status", "paid")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(40);

  const counts = new Map<string, number>();
  for (const order of itemRows ?? []) {
    for (const raw of (order.order_items as unknown[]) ?? []) {
      const row = raw as { quantity?: number; menu_item?: { name?: string } | null };
      const name = row.menu_item?.name;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + (Number(row.quantity) || 0));
    }
  }
  const favoriteItem =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const visits = Number(profile.total_visits) || 0;
  let draft = favoriteItem
    ? `Salaan! Waan ku xasuusanay — ${favoriteItem} ayaad jeceshahay. ${visits} jeer ayaad na soo booqatay. Soo dhawoow markale.`
    : `Salaan! Waan ku xasuusanay. ${visits} jeer ayaad na soo booqatay. Soo dhawoow markale — waan ku soo dhawaynaynaa.`;

  try {
    const result = await generateText({
      model: HILAAC_AI_MODEL,
      system: `Write a warm, short WhatsApp message in Somali to a loyal customer who hasn't visited
in the given days. Mention their favorite item if provided and visit count.
Mention their loyalty without being pushy. Offer a genuine welcome back.
Under 50 words. Do not invent offers or prices — if including a promo, it will be added separately.
Use only the facts provided.`,
      prompt: JSON.stringify({
        restaurant: restaurant.name,
        daysSinceLast,
        favoriteItem,
        totalVisits: visits,
      }),
    });
    const text = result.text?.trim();
    if (text) draft = text;
  } catch (err) {
    console.error("[reengage/preview] openai", err);
  }

  const { data: campaigns } = await admin
    .from("campaigns")
    .select("id, name, code, discount_type, discount_value, is_active, valid_to")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(30);

  const today = new Date().toISOString().slice(0, 10);
  const activeCampaigns = (campaigns ?? []).filter((c) => String(c.valid_to) >= today);

  return NextResponse.json({
    draft,
    customerPhone,
    daysSinceLast,
    favoriteItem,
    totalVisits: visits,
    campaigns: activeCampaigns,
  });
}
