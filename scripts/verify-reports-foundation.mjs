/**
 * Verify reports shared foundation across all 5 timeframes.
 * Mirrors get_kpi_summary + get_revenue_by_period + chart zero-fill.
 *
 * Usage: node scripts/verify-reports-foundation.mjs [restaurant_slug]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local optional if vars already exported
  }
}

loadEnv();

const TZ = "Africa/Nairobi";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const n = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { year: n("year"), month: n("month"), day: n("day"), hour: n("hour") };
}

function zonedMidnightToUtc(year, month, day) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let ms = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(ms))
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value])
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
    ms += desired - asUtc;
  }
  return new Date(ms);
}

function addDays(ymd, days) {
  const a = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12));
  a.setUTCDate(a.getUTCDate() + days);
  return { year: a.getUTCFullYear(), month: a.getUTCMonth() + 1, day: a.getUTCDate() };
}

function dayBounds(offset = 0) {
  const today = zonedParts(new Date());
  const ymd = addDays({ year: today.year, month: today.month, day: today.day }, offset);
  const start = zonedMidnightToUtc(ymd.year, ymd.month, ymd.day);
  const next = addDays(ymd, 1);
  const end = zonedMidnightToUtc(next.year, next.month, next.day);
  return { start, end };
}

function monthBounds(offset = 0) {
  const { year, month } = zonedParts(new Date());
  const total = year * 12 + (month - 1) + offset;
  const sy = Math.floor(total / 12);
  const sm = (total % 12) + 1;
  const et = total + 1;
  return {
    start: zonedMidnightToUtc(sy, sm, 1),
    end: zonedMidnightToUtc(Math.floor(et / 12), (et % 12) + 1, 1),
  };
}

function yearBounds(offset = 0) {
  const { year } = zonedParts(new Date());
  const y = year + offset;
  return { start: zonedMidnightToUtc(y, 1, 1), end: zonedMidnightToUtc(y + 1, 1, 1) };
}

function getDateRange(tf) {
  switch (tf) {
    case "daily":
      return dayBounds(0);
    case "weekly": {
      const { end } = dayBounds(0);
      const { start } = dayBounds(-6);
      return { start, end };
    }
    case "biweekly": {
      const { end } = dayBounds(0);
      const { start } = dayBounds(-13);
      return { start, end };
    }
    case "monthly":
      return monthBounds(0);
    case "yearly":
      return yearBounds(0);
    default:
      return dayBounds(0);
  }
}

function chartBucket(tf) {
  if (tf === "daily") return "hourly";
  if (tf === "yearly") return "monthly";
  return "daily";
}

function expectedBucketCount(tf, start, end) {
  const g = chartBucket(tf);
  if (g === "hourly") return 24;
  if (g === "monthly") return 12;
  // daily
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function formatLabel(start, end) {
  const fmt = (d) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  const last = new Date(end.getTime() - 1);
  const a = fmt(start);
  const b = fmt(last);
  return a === b ? a : `${a} – ${b}`;
}

async function kpiFor(restaurantId, start, end) {
  // Same filters as get_kpi_summary (paid, distinct orders, items from order_items)
  const { data: orders, error: oErr } = await supabase
    .from("orders")
    .select("id, total")
    .eq("restaurant_id", restaurantId)
    .eq("payment_status", "paid")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (oErr) throw oErr;

  const orderIds = (orders ?? []).map((o) => o.id);
  const totalOrders = orderIds.length;
  const totalRevenue = (orders ?? []).reduce((s, o) => s + Number(o.total), 0);
  const aov = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

  let itemsSold = 0;
  if (orderIds.length) {
    const { data: items, error: iErr } = await supabase
      .from("order_items")
      .select("quantity, order_id")
      .in("order_id", orderIds);
    if (iErr) throw iErr;
    itemsSold = (items ?? []).reduce((s, i) => s + Number(i.quantity || 0), 0);
  }

  return { totalOrders, totalRevenue, aov, itemsSold };
}

async function sparseBuckets(restaurantId, start, end, granularity) {
  // Fetch paid orders and bucket in JS the same way as SQL (Africa/Nairobi trunc)
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, total, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("payment_status", "paid")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (error) throw error;

  const map = new Map();
  for (const o of orders ?? []) {
    const d = new Date(o.created_at);
    const p = zonedParts(d);
    let keyStart;
    if (granularity === "hourly") {
      keyStart = new Date(zonedMidnightToUtc(p.year, p.month, p.day).getTime() + p.hour * 3600000);
    } else if (granularity === "monthly") {
      keyStart = zonedMidnightToUtc(p.year, p.month, 1);
    } else {
      keyStart = zonedMidnightToUtc(p.year, p.month, p.day);
    }
    const key = keyStart.toISOString();
    const cur = map.get(key) ?? { period_start: key, order_count: 0, revenue: 0 };
    cur.order_count += 1;
    cur.revenue += Number(o.total);
    map.set(key, cur);
  }
  return [...map.values()];
}

function fillBuckets(sparse, start, end, granularity) {
  const byKey = new Map(sparse.map((r) => [r.period_start, r]));
  const out = [];
  let cursor;
  const p0 = zonedParts(start);
  if (granularity === "hourly") {
    cursor = new Date(zonedMidnightToUtc(p0.year, p0.month, p0.day).getTime() + p0.hour * 3600000);
  } else if (granularity === "monthly") {
    cursor = zonedMidnightToUtc(p0.year, p0.month, 1);
  } else {
    cursor = zonedMidnightToUtc(p0.year, p0.month, p0.day);
  }
  if (cursor < start) {
    if (granularity === "hourly") cursor = new Date(cursor.getTime() + 3600000);
    else if (granularity === "monthly") {
      const nm = p0.month === 12 ? 1 : p0.month + 1;
      const ny = p0.month === 12 ? p0.year + 1 : p0.year;
      cursor = zonedMidnightToUtc(ny, nm, 1);
    } else {
      const n = addDays({ year: p0.year, month: p0.month, day: p0.day }, 1);
      cursor = zonedMidnightToUtc(n.year, n.month, n.day);
    }
  }

  while (cursor < end) {
    const key = cursor.toISOString();
    out.push(byKey.get(key) ?? { period_start: key, order_count: 0, revenue: 0 });
    if (granularity === "hourly") {
      cursor = new Date(cursor.getTime() + 3600000);
    } else if (granularity === "monthly") {
      const p = zonedParts(cursor);
      const nm = p.month === 12 ? 1 : p.month + 1;
      const ny = p.month === 12 ? p.year + 1 : p.year;
      cursor = zonedMidnightToUtc(ny, nm, 1);
    } else {
      const p = zonedParts(cursor);
      const n = addDays({ year: p.year, month: p.month, day: p.day }, 1);
      cursor = zonedMidnightToUtc(n.year, n.month, n.day);
    }
  }
  return out;
}

async function main() {
  const slugArg = process.argv[2];
  let q = supabase.from("restaurants").select("id, slug, name").limit(1);
  if (slugArg) q = supabase.from("restaurants").select("id, slug, name").eq("slug", slugArg).limit(1);
  const { data: restaurants, error } = await q;
  if (error) throw error;
  const restaurant = restaurants?.[0];
  if (!restaurant) {
    console.error("No restaurant found");
    process.exit(1);
  }

  console.log(`\nRestaurant: ${restaurant.name} (${restaurant.slug})`);
  console.log(`Timezone: ${TZ}\n`);

  const timeframes = ["daily", "weekly", "biweekly", "monthly", "yearly"];
  const results = [];
  let allPass = true;

  for (const tf of timeframes) {
    const { start, end } = getDateRange(tf);
    const bucket = chartBucket(tf);
    const kpi = await kpiFor(restaurant.id, start, end);
    const sparse = await sparseBuckets(restaurant.id, start, end, bucket);
    const filled = fillBuckets(sparse, start, end, bucket);
    const chartSum = filled.reduce((s, r) => s + r.revenue, 0);
    const nonZero = filled.filter((r) => r.revenue > 0 || r.order_count > 0).length;
    const expectedBuckets = expectedBucketCount(tf, start, end);
    const label = formatLabel(start, end);

    const ordersLeItems = kpi.totalOrders <= kpi.itemsSold || kpi.totalOrders === 0;
    const aovOk =
      kpi.totalOrders === 0 ||
      Math.abs(kpi.aov - Math.round((kpi.totalRevenue / kpi.totalOrders) * 100) / 100) < 0.02;
    const chartOk = filled.length === expectedBuckets && (kpi.totalOrders === 0 || nonZero > 0);
    const revMatch = Math.abs(chartSum - kpi.totalRevenue) < 0.05;
    const pass = ordersLeItems && aovOk && chartOk && revMatch;
    if (!pass) allPass = false;

    results.push({
      tf,
      label,
      start: start.toISOString(),
      end: end.toISOString(),
      bucket,
      ...kpi,
      filledBuckets: filled.length,
      expectedBuckets,
      nonZeroBuckets: nonZero,
      chartSum: Math.round(chartSum * 100) / 100,
      pass,
      checks: { ordersLeItems, aovOk, chartOk, revMatch },
    });
  }

  for (const r of results) {
    console.log("─".repeat(72));
    console.log(`${r.tf.toUpperCase()}  |  ${r.label}`);
    console.log(`  range: ${r.start} → ${r.end}`);
    console.log(`  bucket: ${r.bucket}  |  points: ${r.filledBuckets} (expected ${r.expectedBuckets}), non-zero: ${r.nonZeroBuckets}`);
    console.log(
      `  orders=${r.totalOrders}  items_sold=${r.itemsSold}  revenue=${r.totalRevenue.toFixed(2)}  aov=${r.aov.toFixed(2)}  chartSum=${r.chartSum.toFixed(2)}`
    );
    console.log(
      `  checks: orders≤items=${r.checks.ordersLeItems}  aov=${r.checks.aovOk}  chart=${r.checks.chartOk}  revMatch=${r.checks.revMatch}  → ${r.pass ? "PASS" : "FAIL"}`
    );
  }
  console.log("─".repeat(72));
  console.log(allPass ? "\nALL FIVE TIMEFRAMES PASSED\n" : "\nSOME CHECKS FAILED\n");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
