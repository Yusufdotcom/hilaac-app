import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppDayBounds, getAppMonthBounds } from "@/lib/time/app-calendar";
import {
  bucketRatings,
  countSegments,
  returningSalesShare,
  type FeedbackBuckets,
  type SegmentCounts,
} from "@/lib/customers/customer-segments";

export type CustomerIntelligenceData = {
  totalCustomers: number;
  newThisMonth: number;
  returningCount: number;
  avgSpend: number;
  segments: SegmentCounts;
  segmentTotal: number;
  returningSalesPct: number | null;
  feedback: FeedbackBuckets;
  topProducts: { name: string; quantity: number; revenue: number }[];
};

export async function fetchCustomerIntelligence(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<CustomerIntelligenceData> {
  const now = new Date();
  const { start: monthStart } = getAppMonthBounds(0, now);
  const { start: d30 } = getAppDayBounds(-29, now);
  const { end: todayEnd } = getAppDayBounds(0, now);

  const [profilesRes, orders30Res, revenueRes, topRes, ratingsRes] = await Promise.all([
    supabase
      .from("customer_profiles")
      .select("*")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("orders")
      .select("customer_phone, total, created_at")
      .eq("restaurant_id", restaurantId)
      .eq("payment_status", "paid")
      .not("customer_phone", "is", null)
      .neq("status", "cancelled")
      .gte("created_at", d30.toISOString())
      .lt("created_at", todayEnd.toISOString()),
    supabase
      .from("orders")
      .select("customer_phone, total")
      .eq("restaurant_id", restaurantId)
      .eq("payment_status", "paid")
      .not("customer_phone", "is", null)
      .neq("status", "cancelled")
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", todayEnd.toISOString()),
    supabase.rpc("get_top_items", {
      p_restaurant_id: restaurantId,
      p_start_date: monthStart.toISOString(),
      p_end_date: todayEnd.toISOString(),
      p_limit: 8,
    }),
    supabase
      .from("orders")
      .select("customer_rating")
      .eq("restaurant_id", restaurantId)
      .not("customer_rating", "is", null)
      .gte("customer_rated_at", d30.toISOString()),
  ]);

  if (profilesRes.error) {
    console.error("[customers] profiles", profilesRes.error.message);
  }

  const profiles = (profilesRes.data ?? []) as {
    restaurant_id: string;
    customer_phone: string;
    total_visits: number;
    lifetime_spend: number;
    last_visit: string;
    first_visit: string;
  }[];

  const visits30 = new Map<string, number>();
  for (const row of orders30Res.data ?? []) {
    const phone = String(row.customer_phone ?? "");
    if (!phone) continue;
    visits30.set(phone, (visits30.get(phone) ?? 0) + 1);
  }

  const enriched = profiles.map((p) => ({
    ...p,
    total_visits: Number(p.total_visits) || 0,
    lifetime_spend: Number(p.lifetime_spend) || 0,
    visits_last_30d: visits30.get(p.customer_phone) ?? 0,
  }));

  const segments = countSegments(enriched, now);
  const segmentTotal =
    segments.vip + segments.regular + segments.new + segments.at_risk;

  const totalCustomers = profiles.length;
  const newThisMonth = profiles.filter(
    (p) => new Date(p.first_visit).getTime() >= monthStart.getTime()
  ).length;
  const returningCount = profiles.filter((p) => Number(p.total_visits) > 1).length;
  const avgSpend =
    totalCustomers === 0
      ? 0
      : profiles.reduce((s, p) => s + (Number(p.lifetime_spend) || 0), 0) / totalCustomers;

  // Returning sales share this month
  const visitTotals = new Map(profiles.map((p) => [p.customer_phone, Number(p.total_visits) || 0]));
  let monthRevenue = 0;
  let returningRevenue = 0;
  for (const row of revenueRes.data ?? []) {
    const total = Number(row.total) || 0;
    monthRevenue += total;
    const phone = String(row.customer_phone ?? "");
    if ((visitTotals.get(phone) ?? 0) > 1) returningRevenue += total;
  }

  const topProducts = ((topRes.data as unknown[]) ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      name: String(row.item_name ?? "Item"),
      quantity: Number(row.quantity_sold ?? 0) || 0,
      revenue: Number(row.revenue ?? 0) || 0,
    };
  });

  const ratings = ((ratingsRes.data ?? []) as { customer_rating: number }[])
    .map((r) => Number(r.customer_rating))
    .filter((n) => n >= 1 && n <= 5);

  return {
    totalCustomers,
    newThisMonth,
    returningCount,
    avgSpend,
    segments,
    segmentTotal,
    returningSalesPct: returningSalesShare(returningRevenue, monthRevenue),
    feedback: bucketRatings(ratings),
    topProducts,
  };
}
