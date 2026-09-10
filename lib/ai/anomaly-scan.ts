import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppDayBounds, getAppMonthBounds, getZonedYmd } from "@/lib/time/app-calendar";
import { parseWasteFromExpense } from "@/lib/inventory/inventory-math";

export type AnomalyCandidate = {
  dedupe_key: string;
  severity: "urgent" | "important" | "normal";
  title: string;
  description: string;
  why_it_matters: string;
  action_label: string;
  href: string;
};

function isoWeekKey(d: Date): string {
  const ymd = getZonedYmd(d);
  const utc = Date.UTC(ymd.year, ymd.month - 1, ymd.day);
  const dayNum = new Date(utc).getUTCDay() || 7;
  const thursday = new Date(utc);
  thursday.setUTCDate(new Date(utc).getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(d: Date): string {
  const ymd = getZonedYmd(d);
  return `${ymd.year}-${String(ymd.month).padStart(2, "0")}`;
}

function eatHourNow(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

function eatDow(now: Date = new Date()): number {
  // 0=Sun … 6=Sat in Africa/Nairobi
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? now.getUTCDay();
}

async function checkCashierGap(
  supabase: SupabaseClient,
  restaurantId: string,
  slug: string,
  now: Date
): Promise<AnomalyCandidate | null> {
  const { start } = getAppDayBounds(-6, now);
  const { end } = getAppDayBounds(0, now);

  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .neq("status", "cancelled");

  if (error) {
    console.error("[ai-anomaly] cashier gap query", error.message);
    return null;
  }

  let readyPath = 0;
  let delivered = 0;
  for (const row of data ?? []) {
    const status = String(row.status);
    if (status === "ready" || status === "delivered" || status === "completed") {
      readyPath += 1;
    }
    if (status === "delivered" || status === "completed") {
      delivered += 1;
    }
  }
  const gap = readyPath - delivered;
  if (gap <= 2) return null;

  return {
    dedupe_key: `cashier_gap:${isoWeekKey(now)}`,
    severity: "important",
    title: `Cashier confirmed ${gap} fewer orders than Kitchen marked Ready this week`,
    description: `Kitchen Ready path: ${readyPath}. Cashier Delivered/Completed: ${delivered}. Gap: ${gap}.`,
    why_it_matters:
      "A sustained Ready→Delivered gap often means payment/ops friction or orders stuck on the floor.",
    action_label: "Review orders",
    href: `/admin/${slug}/orders`,
  };
}

async function checkAovDrop(
  supabase: SupabaseClient,
  restaurantId: string,
  slug: string,
  now: Date
): Promise<AnomalyCandidate | null> {
  const recentStart = getAppDayBounds(-2, now).start;
  const recentEnd = getAppDayBounds(0, now).end;
  const priorStart = getAppDayBounds(-9, now).start;
  const priorEnd = getAppDayBounds(-3, now).end;

  const [recentRes, priorRes] = await Promise.all([
    supabase.rpc("get_kpi_summary", {
      p_restaurant_id: restaurantId,
      p_start_date: recentStart.toISOString(),
      p_end_date: recentEnd.toISOString(),
    }),
    supabase.rpc("get_kpi_summary", {
      p_restaurant_id: restaurantId,
      p_start_date: priorStart.toISOString(),
      p_end_date: priorEnd.toISOString(),
    }),
  ]);

  if (recentRes.error || priorRes.error) {
    console.error(
      "[ai-anomaly] aov",
      recentRes.error?.message ?? priorRes.error?.message
    );
    return null;
  }

  const recent = (Array.isArray(recentRes.data) ? recentRes.data[0] : recentRes.data) as
    | Record<string, unknown>
    | undefined;
  const prior = (Array.isArray(priorRes.data) ? priorRes.data[0] : priorRes.data) as
    | Record<string, unknown>
    | undefined;

  const recentAov = Number(recent?.avg_order_value ?? recent?.average_order_value ?? 0) || 0;
  const priorAov = Number(prior?.avg_order_value ?? prior?.average_order_value ?? 0) || 0;
  if (!(priorAov > 0) || !(recentAov >= 0)) return null;

  const dropPct = ((priorAov - recentAov) / priorAov) * 100;
  if (dropPct <= 20) return null;

  return {
    dedupe_key: `aov_drop:${isoWeekKey(now)}`,
    severity: "important",
    title: `Average order value down ${Math.round(dropPct)}% (last 3 days)`,
    description: `Recent AOV $${recentAov.toFixed(2)} vs prior 7-day AOV $${priorAov.toFixed(2)}.`,
    why_it_matters:
      "A sharp AOV drop can mean weaker upsells, more small tickets, or pricing/promo issues.",
    action_label: "Open Reports",
    href: `/admin/${slug}/reports`,
  };
}

async function checkWasteSpike(
  supabase: SupabaseClient,
  restaurantId: string,
  slug: string,
  now: Date
): Promise<AnomalyCandidate[]> {
  const { start: monthStart, end: monthEnd } = getAppMonthBounds(0, now);
  const { start: prevStart, end: prevEnd } = getAppMonthBounds(-1, now);

  const [thisRes, prevRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, amount, date, note, category")
      .eq("restaurant_id", restaurantId)
      .gte("date", monthStart.toISOString().slice(0, 10))
      .lt("date", monthEnd.toISOString().slice(0, 10))
      .in("category", ["supplies", "other"]),
    supabase
      .from("expenses")
      .select("id, amount, date, note, category")
      .eq("restaurant_id", restaurantId)
      .gte("date", prevStart.toISOString().slice(0, 10))
      .lt("date", prevEnd.toISOString().slice(0, 10))
      .in("category", ["supplies", "other"]),
  ]);

  if (thisRes.error || prevRes.error) {
    console.error(
      "[ai-anomaly] waste",
      thisRes.error?.message ?? prevRes.error?.message
    );
    return [];
  }

  const sumByItem = (rows: { id: string; amount: number; date: string; note: string | null }[]) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const waste = parseWasteFromExpense(row);
      if (!waste) continue;
      map.set(waste.productName, (map.get(waste.productName) ?? 0) + waste.lossUsd);
    }
    return map;
  };

  const thisMonth = sumByItem((thisRes.data ?? []) as never);
  const prevMonth = sumByItem((prevRes.data ?? []) as never);
  if (thisMonth.size === 0 && prevMonth.size === 0) return [];

  const out: AnomalyCandidate[] = [];
  for (const [item, amount] of thisMonth) {
    const prev = prevMonth.get(item) ?? 0;
    if (!(prev > 0)) continue;
    if (amount <= prev * 1.3) continue;
    const pct = Math.round(((amount - prev) / prev) * 100);
    out.push({
      dedupe_key: `waste_spike:${monthKey(now)}:${item.toLowerCase().slice(0, 40)}`,
      severity: "important",
      title: `Waste up ${pct}% MoM on ${item}`,
      description: `This month $${amount.toFixed(2)} vs last month $${prev.toFixed(2)}.`,
      why_it_matters: "Waste spikes cut margin — check prep, portioning, and spoilage for this item.",
      action_label: "View inventory",
      href: `/admin/${slug}/inventory`,
    });
  }
  return out;
}

async function checkRevenueAnomaly(
  supabase: SupabaseClient,
  restaurantId: string,
  slug: string,
  now: Date
): Promise<AnomalyCandidate | null> {
  if (eatHourNow(now) < 18) return null;

  const { start: todayStart, end: todayEnd } = getAppDayBounds(0, now);
  const lookbackStart = getAppDayBounds(-56, now).start;

  const [todayRes, histRes] = await Promise.all([
    supabase.rpc("get_kpi_summary", {
      p_restaurant_id: restaurantId,
      p_start_date: todayStart.toISOString(),
      p_end_date: todayEnd.toISOString(),
    }),
    supabase.rpc("get_revenue_by_period", {
      p_restaurant_id: restaurantId,
      p_start_date: lookbackStart.toISOString(),
      p_end_date: todayStart.toISOString(),
      p_granularity: "daily",
    }),
  ]);

  if (todayRes.error || histRes.error) {
    console.error(
      "[ai-anomaly] revenue",
      todayRes.error?.message ?? histRes.error?.message
    );
    return null;
  }

  const todayRow = (Array.isArray(todayRes.data) ? todayRes.data[0] : todayRes.data) as
    | Record<string, unknown>
    | undefined;
  const todayRev = Number(todayRow?.total_revenue ?? 0) || 0;

  const targetDow = eatDow(now);
  const sameDowRevenues: number[] = [];
  for (const raw of (histRes.data as unknown[]) ?? []) {
    const row = raw as Record<string, unknown>;
    const period = String(row.period_start ?? "");
    if (!period) continue;
    const d = new Date(period);
    if (Number.isNaN(d.getTime())) continue;
    if (eatDow(d) !== targetDow) continue;
    const rev = Number(row.revenue ?? 0) || 0;
    if (rev > 0) sameDowRevenues.push(rev);
  }

  if (sameDowRevenues.length < 2) return null;
  const typical =
    sameDowRevenues.reduce((s, n) => s + n, 0) / sameDowRevenues.length;
  if (!(typical > 0)) return null;
  if (todayRev >= typical * 0.4) return null;

  const ymd = getZonedYmd(now);
  const dayKey = `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;

  return {
    dedupe_key: `revenue_slow:${dayKey}`,
    severity: "important",
    title: `Today's revenue is under 40% of a typical same weekday`,
    description: `By 18:00 EAT: $${todayRev.toFixed(2)} vs typical $${typical.toFixed(2)} for this weekday.`,
    why_it_matters:
      "A soft evening vs the usual day-of-week pattern may need a promo push or staffing check.",
    action_label: "Open Dashboard",
    href: `/admin/${slug}/dashboard`,
  };
}

/** Run all threshold rules (SQL/RPC only — no LLM). */
export async function detectAnomaliesForRestaurant(
  supabase: SupabaseClient,
  restaurant: { id: string; slug: string },
  now: Date = new Date()
): Promise<AnomalyCandidate[]> {
  const [cashier, aov, waste, revenue] = await Promise.all([
    checkCashierGap(supabase, restaurant.id, restaurant.slug, now),
    checkAovDrop(supabase, restaurant.id, restaurant.slug, now),
    checkWasteSpike(supabase, restaurant.id, restaurant.slug, now),
    checkRevenueAnomaly(supabase, restaurant.id, restaurant.slug, now),
  ]);

  return [
    ...(cashier ? [cashier] : []),
    ...(aov ? [aov] : []),
    ...waste,
    ...(revenue ? [revenue] : []),
  ];
}

/** Upsert active ai_alerts by (restaurant_id, dedupe_key). */
export async function upsertAiAlerts(
  supabase: SupabaseClient,
  restaurantId: string,
  candidates: AnomalyCandidate[]
): Promise<{ upserted: number; errors: number }> {
  let upserted = 0;
  let errors = 0;

  for (const c of candidates) {
    const { data: existing } = await supabase
      .from("ai_alerts")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("dedupe_key", c.dedupe_key)
      .is("dismissed_at", null)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("ai_alerts")
        .update({
          severity: c.severity,
          title: c.title,
          description: c.description,
          why_it_matters: c.why_it_matters,
          action_label: c.action_label,
          href: c.href,
          source: "ai",
        })
        .eq("id", existing.id);
      if (error) {
        console.error("[ai-anomaly] update", error.message);
        errors += 1;
      } else {
        upserted += 1;
      }
      continue;
    }

    const { error } = await supabase.from("ai_alerts").insert({
      restaurant_id: restaurantId,
      severity: c.severity,
      title: c.title,
      description: c.description,
      why_it_matters: c.why_it_matters,
      action_label: c.action_label,
      href: c.href,
      source: "ai",
      dedupe_key: c.dedupe_key,
    });
    if (error) {
      console.error("[ai-anomaly] insert", error.message);
      errors += 1;
    } else {
      upserted += 1;
    }
  }

  return { upserted, errors };
}
