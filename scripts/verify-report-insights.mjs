/**
 * Verify Insights rule engine against a restaurant's live RPC data.
 *
 * Usage:
 *   node scripts/verify-report-insights.mjs [slug] [granularity]
 * Defaults: baba-s-grill-and-cafe, weekly
 *
 * Requires linked Supabase CLI / env used by other verify scripts.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const slug = process.argv[2] ?? "baba-s-grill-and-cafe";
const granularity = process.argv[3] ?? "weekly";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / service role key");
  process.exit(1);
}

// Inline minimal ports of computeInsights + date helpers (keep script runnable without TS).
const TREND_MIN_GROWTH = 25;
const TREND_MIN_QTY = 5;

function getAppDayBounds(dayOffset = 0) {
  const tz = "Africa/Nairobi";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const num = (t) => Number(parts.find((p) => p.type === t)?.value);
  const anchor = new Date(Date.UTC(num("year"), num("month") - 1, num("day") + dayOffset, 12));
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth() + 1;
  const d = anchor.getUTCDate();
  // Approximate EAT = UTC+3
  const start = new Date(Date.UTC(y, m - 1, d, -3, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, -3, 0, 0));
  return { start, end };
}

function getDateRange(g, offset = 0) {
  if (g === "daily") return getAppDayBounds(offset);
  if (g === "weekly") {
    const { end } = getAppDayBounds(offset * 7);
    const { start } = getAppDayBounds(offset * 7 - 6);
    return { start, end };
  }
  if (g === "biweekly") {
    const { end } = getAppDayBounds(offset * 14);
    const { start } = getAppDayBounds(offset * 14 - 13);
    return { start, end };
  }
  // monthly approx via day math is imperfect; use weekly-like for verify default
  const { end } = getAppDayBounds(offset * 30);
  const { start } = getAppDayBounds(offset * 30 - 29);
  return { start, end };
}

function normalizeItems(rows) {
  return (rows ?? []).map((row) => ({
    item_name: String(row.item_name ?? "Unknown"),
    quantity_sold: Number(row.quantity_sold ?? 0) || 0,
    revenue: Number(row.revenue ?? 0) || 0,
  }));
}

const supabase = createClient(url, key);

const { data: restaurant, error: rErr } = await supabase
  .from("restaurants")
  .select("id, name, slug")
  .eq("slug", slug)
  .maybeSingle();

if (rErr || !restaurant) {
  console.error("Restaurant not found", slug, rErr?.message);
  process.exit(1);
}

const { start, end } = getDateRange(granularity, 0);
const prev = getDateRange(granularity, -1);
const rpc = {
  p_restaurant_id: restaurant.id,
  p_start_date: start.toISOString(),
  p_end_date: end.toISOString(),
};
const prevRpc = {
  p_restaurant_id: restaurant.id,
  p_start_date: prev.start.toISOString(),
  p_end_date: prev.end.toISOString(),
};

const [kpi, prevKpi, top, prevTop, peak, pay, recent14, prior30] = await Promise.all([
  supabase.rpc("get_kpi_summary", rpc),
  supabase.rpc("get_kpi_summary", prevRpc),
  supabase.rpc("get_top_items", { ...rpc, p_limit: 25 }),
  supabase.rpc("get_top_items", { ...prevRpc, p_limit: 25 }),
  supabase.rpc("get_peak_hours", rpc),
  supabase.rpc("get_payment_split", rpc),
  supabase.rpc("get_top_items", {
    p_restaurant_id: restaurant.id,
    p_start_date: getAppDayBounds(-13).start.toISOString(),
    p_end_date: getAppDayBounds(0).end.toISOString(),
    p_limit: 50,
  }),
  supabase.rpc("get_top_items", {
    p_restaurant_id: restaurant.id,
    p_start_date: getAppDayBounds(-43).start.toISOString(),
    p_end_date: getAppDayBounds(-13).start.toISOString(),
    p_limit: 50,
  }),
]);

for (const [label, res] of [
  ["kpi", kpi],
  ["prevKpi", prevKpi],
  ["top", top],
  ["prevTop", prevTop],
  ["peak", peak],
  ["pay", pay],
  ["recent14", recent14],
  ["prior30", prior30],
]) {
  if (res.error) {
    console.error(label, res.error.message);
    process.exit(1);
  }
}

const currentItems = normalizeItems(top.data).filter((i) => i.quantity_sold > 0);
const previousItems = normalizeItems(prevTop.data);
const prevMap = new Map(previousItems.map((i) => [i.item_name, i.quantity_sold]));

console.log(`\n=== Insights verify: ${restaurant.name} (${slug}) · ${granularity} ===`);
console.log(`Window: ${rpc.p_start_date} → ${rpc.p_end_date}`);
console.log(`Prev:    ${prevRpc.p_start_date} → ${prevRpc.p_end_date}`);

const rev = Number(kpi.data?.[0]?.total_revenue ?? 0);
const prevRev = Number(prevKpi.data?.[0]?.total_revenue ?? 0);
const revPct = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : rev > 0 ? 100 : 0;
console.log(`\nRevenue: ${rev} vs prev ${prevRev} → ${revPct.toFixed(1)}%`);

console.log("\n--- Trending candidates (≥25% up, qty≥5, prev>0) ---");
for (const item of currentItems) {
  const prevQty = prevMap.get(item.item_name) ?? 0;
  if (item.quantity_sold < TREND_MIN_QTY || prevQty <= 0) continue;
  const growth = ((item.quantity_sold - prevQty) / prevQty) * 100;
  if (growth < TREND_MIN_GROWTH) continue;
  console.log(
    `✓ ${item.item_name}: ${prevQty} → ${item.quantity_sold} (${growth.toFixed(1)}%)`
  );
}

const recentNames = new Set(
  normalizeItems(recent14.data)
    .filter((i) => i.quantity_sold > 0)
    .map((i) => i.item_name)
);
console.log("\n--- Underperforming (0 in last 14d, ≥5 in prior 30d) ---");
const under = normalizeItems(prior30.data)
  .filter((i) => i.quantity_sold >= TREND_MIN_QTY && !recentNames.has(i.item_name))
  .sort((a, b) => b.quantity_sold - a.quantity_sold)
  .slice(0, 3);
for (const item of under) {
  console.log(`✓ ${item.item_name}: prior30 qty=${item.quantity_sold}`);
}
if (!under.length) console.log("(none)");

const hours = peak.data ?? [];
const totalOrders = hours.reduce((s, h) => s + (Number(h.order_count) || 0), 0);
let best = null;
for (let h = 0; h < 23; h++) {
  const a = Number(hours.find((x) => Number(x.hour_of_day) === h)?.order_count ?? 0);
  const b = Number(hours.find((x) => Number(x.hour_of_day) === h + 1)?.order_count ?? 0);
  const combined = a + b;
  if (!best || combined > best.count) best = { start: h, count: combined };
}
if (best && totalOrders > 0) {
  const share = (best.count / totalOrders) * 100;
  console.log(
    `\n--- Peak 2h block: ${String(best.start).padStart(2, "0")}:00–${String(best.start + 2).padStart(2, "0")}:00 = ${best.count}/${totalOrders} (${share.toFixed(1)}%)${share > 30 ? " → INSIGHT" : ""}`
  );
}

const payRows = pay.data ?? [];
const payTotal = payRows.reduce((s, p) => s + (Number(p.order_count) || 0), 0);
if (payTotal > 0) {
  const topPay = [...payRows].sort(
    (a, b) => (Number(b.order_count) || 0) - (Number(a.order_count) || 0)
  )[0];
  const share = ((Number(topPay.order_count) || 0) / payTotal) * 100;
  console.log(
    `\n--- Payment top: ${topPay.payment_method} ${share.toFixed(1)}%${share > 70 ? " → INSIGHT" : ""}`
  );
}

console.log("\nDone.\n");
