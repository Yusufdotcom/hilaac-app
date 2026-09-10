import type { SupabaseClient } from "@supabase/supabase-js";

export type RamadanOverview = {
  season: "ramadan" | "eid";
  precollectedRevenue: number;
  paidSubscriptions: number;
  normalCheckedIn: number;
  normalPaid: number;
  buffetCheckedIn: number;
  buffetPaid: number;
  noShowsEstimate: number;
  buffetCapacity: number | null;
  buffetOccupancy: number;
};

export async function fetchRamadanOverview(
  supabase: SupabaseClient,
  restaurantId: string,
  season: "ramadan" | "eid"
): Promise<RamadanOverview> {
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: packages }, { data: subs }, { data: checkins }] = await Promise.all([
    supabase
      .from("ramadan_packages")
      .select("id, type, max_daily_capacity, price, is_active, season")
      .eq("restaurant_id", restaurantId)
      .eq("season", season)
      .eq("is_active", true),
    supabase
      .from("ramadan_subscriptions")
      .select("id, package_id, payment_status, payment_amount")
      .eq("restaurant_id", restaurantId)
      .eq("payment_status", "paid"),
    supabase
      .from("ramadan_checkins")
      .select("id, package_id, subscription_id")
      .eq("restaurant_id", restaurantId)
      .eq("checkin_date", today),
  ]);

  const pkgById = new Map((packages ?? []).map((p) => [p.id, p]));
  const paidSubs = (subs ?? []).filter((s) => pkgById.has(s.package_id));

  let precollectedRevenue = 0;
  let normalPaid = 0;
  let buffetPaid = 0;
  for (const s of paidSubs) {
    const pkg = pkgById.get(s.package_id)!;
    precollectedRevenue += Number(s.payment_amount ?? pkg.price ?? 0) || 0;
    if (pkg.type === "buffet") buffetPaid += 1;
    else normalPaid += 1;
  }

  let normalCheckedIn = 0;
  let buffetCheckedIn = 0;
  for (const c of checkins ?? []) {
    const pkg = pkgById.get(c.package_id);
    if (!pkg) continue;
    if (pkg.type === "buffet") buffetCheckedIn += 1;
    else normalCheckedIn += 1;
  }

  const buffetCaps = (packages ?? [])
    .filter((p) => p.type === "buffet" && p.max_daily_capacity != null)
    .map((p) => Number(p.max_daily_capacity) || 0);
  const buffetCapacity = buffetCaps.length ? Math.max(...buffetCaps) : null;

  const noShowsEstimate = Math.max(0, normalPaid - normalCheckedIn) + Math.max(0, buffetPaid - buffetCheckedIn);

  return {
    season,
    precollectedRevenue,
    paidSubscriptions: paidSubs.length,
    normalCheckedIn,
    normalPaid,
    buffetCheckedIn,
    buffetPaid,
    noShowsEstimate,
    buffetCapacity,
    buffetOccupancy: buffetCheckedIn,
  };
}

export type KitchenPrepData = {
  season: "ramadan" | "eid";
  date: string;
  normal: { packageName: string; mealType: string | null; count: number; items: string[] }[];
  buffet: {
    packageName: string;
    maxCapacity: number | null;
    passesSold: number;
    checkedIn: number;
    window: string | null;
  }[];
};

export async function fetchKitchenPrep(
  supabase: SupabaseClient,
  restaurantId: string,
  season: "ramadan" | "eid"
): Promise<KitchenPrepData> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: packages } = await supabase
    .from("ramadan_packages")
    .select(
      "id, name, type, meal_type, menu_items, max_daily_capacity, buffet_start_time, buffet_end_time, is_active, season"
    )
    .eq("restaurant_id", restaurantId)
    .eq("season", season)
    .eq("is_active", true);

  const { data: checkins } = await supabase
    .from("ramadan_checkins")
    .select("package_id")
    .eq("restaurant_id", restaurantId)
    .eq("checkin_date", today);

  const { data: subs } = await supabase
    .from("ramadan_subscriptions")
    .select("package_id, payment_status")
    .eq("restaurant_id", restaurantId)
    .eq("payment_status", "paid");

  const checkinCount = new Map<string, number>();
  for (const c of checkins ?? []) {
    checkinCount.set(c.package_id, (checkinCount.get(c.package_id) ?? 0) + 1);
  }
  const soldCount = new Map<string, number>();
  for (const s of subs ?? []) {
    soldCount.set(s.package_id, (soldCount.get(s.package_id) ?? 0) + 1);
  }

  const normal: KitchenPrepData["normal"] = [];
  const buffet: KitchenPrepData["buffet"] = [];

  for (const pkg of packages ?? []) {
    const count = checkinCount.get(pkg.id) ?? 0;
    if (pkg.type === "buffet") {
      const start = pkg.buffet_start_time ? String(pkg.buffet_start_time).slice(0, 5) : null;
      const end = pkg.buffet_end_time ? String(pkg.buffet_end_time).slice(0, 5) : null;
      buffet.push({
        packageName: pkg.name,
        maxCapacity: pkg.max_daily_capacity != null ? Number(pkg.max_daily_capacity) : null,
        passesSold: soldCount.get(pkg.id) ?? 0,
        checkedIn: count,
        window: start && end ? `${start}–${end}` : null,
      });
    } else {
      const rawItems = Array.isArray(pkg.menu_items) ? pkg.menu_items : [];
      const items = rawItems
        .map((row) => {
          if (typeof row === "string") return row;
          if (row && typeof row === "object" && "name" in row) {
            return String((row as { name?: string }).name ?? "");
          }
          return "";
        })
        .filter(Boolean);
      normal.push({
        packageName: pkg.name,
        mealType: pkg.meal_type,
        count,
        items,
      });
    }
  }

  return { season, date: today, normal, buffet };
}
