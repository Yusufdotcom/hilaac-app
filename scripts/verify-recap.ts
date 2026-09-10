/**
 * Recap + business-hours checks. Does not send email.
 *
 * Usage: npx tsx scripts/verify-recap.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { canReceiveRecapEmail } from "../lib/constants.ts";
import {
  boundsForBusinessDate,
  hoursFromRestaurant,
  lastCompletedBusinessDay,
} from "../lib/recap/business-hours.ts";
import { fetchDailyRecap, fetchMonthlyRecap } from "../lib/recap/fetch-recap.ts";
import { getAppDayBounds } from "../lib/time/app-calendar.ts";

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
    // optional
  }
}

loadEnv();

let passed = 0;
let failed = 0;
function pass(n: string, d = "") {
  passed += 1;
  console.log("PASS ", n, d);
}
function fail(n: string, d = "") {
  failed += 1;
  console.log("FAIL ", n, d);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BOBA_ID = "494ea124-18e9-4d8e-9056-16b673ff31a3";
const BABA_ID = "16681f63-f393-4645-8641-bd4437d8a744";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

if (canReceiveRecapEmail("starter") === false) pass("Starter cannot receive recap email");
else fail("Starter email gate");
if (canReceiveRecapEmail("pro") === true) pass("Pro can receive recap email");
else fail("Pro email gate");
if (canReceiveRecapEmail("trial") === true) pass("Trial can receive recap email");
else fail("Trial email gate");

const dash = read("app/admin/[slug]/dashboard/page.tsx");
if (dash.includes("getAppDayBounds(0)") && dash.includes("get_dashboard_orders_today")) {
  pass("Dashboard Orders Today still uses existing day bounds (not recap hours)");
} else fail("Dashboard today bounds unchanged");
if (dash.includes("<RecapCards") && !dash.includes("canReceiveRecapEmail(restaurant")) {
  pass("Dashboard recap cards are not plan-gated");
} else fail("Dashboard recap card gating");
if (!dash.includes("/api/jobs/") && !dash.includes("sendRecap")) {
  pass("Dashboard does not send recap email");
} else fail("No email send from dashboard");

const cards = read("components/admin/dashboard/recap-cards.tsx");
if (
  cards.includes("Email recaps are included on Gorgor") && cards.includes("canReceiveRecapEmail")
) {
  pass("Starter footnote explains email is Gorgor+");
} else fail("Starter email footnote");

const settings = read("app/admin/[slug]/settings/page.tsx");
if (settings.includes("BusinessHoursCard")) pass("Settings page includes business hours");
else fail("Settings business hours card");

const overnight = boundsForBusinessDate(
  { year: 2026, month: 8, day: 13 },
  { openingTime: "10:00", closingTime: "02:00", businessDays: null }
);
if (
  overnight &&
  overnight.start.toISOString() === "2026-08-13T07:00:00.000Z" &&
  overnight.end.toISOString() === "2026-08-13T23:00:00.000Z"
) {
  pass(
    "Overnight 10:00–02:00 EAT is 07:00–23:00 UTC Aug 13, not UTC midnight",
    `${overnight.start.toISOString()} → ${overnight.end.toISOString()}`
  );
} else {
  fail("Overnight window vs UTC midnight", JSON.stringify(overnight));
}

async function paidCount(restaurantId: string, start: Date, end: Date) {
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("payment_status", "paid")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  return count ?? 0;
}

async function main() {
  const { data: boba } = await admin
    .from("restaurants")
    .select("id, name, subscription_tier")
    .eq("id", BOBA_ID)
    .maybeSingle();
  if (boba) pass("Boba (Pro) exists for email-gate contrast", `${boba.name} tier=${boba.subscription_tier}`);

  const { data: baba, error: babaErr } = await admin
    .from("restaurants")
    .select("id, name, slug, subscription_tier, opening_time, closing_time, business_days")
    .eq("id", BABA_ID)
    .maybeSingle();

  if (babaErr || !baba) {
    fail("Load Baba restaurant", babaErr?.message ?? "missing");
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(1);
  }

  pass("Baba loaded (has paid order history)", `${baba.name} tier=${baba.subscription_tier}`);

  const originalHours = {
    opening_time: baba.opening_time ?? null,
    closing_time: baba.closing_time ?? null,
    business_days: baba.business_days ?? null,
  };

  try {
    const { error: setErr } = await admin
      .from("restaurants")
      .update({ opening_time: "10:00", closing_time: "02:00", business_days: null })
      .eq("id", BABA_ID);
    if (setErr) fail("Set Baba overnight hours", setErr.message);
    else pass("Set Baba hours 10:00–02:00 EAT (overnight)");

    const withHours = {
      ...baba,
      opening_time: "10:00",
      closing_time: "02:00",
      business_days: null as number[] | null,
    };
    const hours = hoursFromRestaurant(withHours);

    // Jul 16 08:00 EAT: last completed day is Jul 15 10:00 → Jul 16 02:00.
    // Paid orders at 02:44/02:52 EAT sit after close, so they are in UTC Jul 15
    // but not in the recap business day.
    const afterJul15Close = new Date("2026-07-16T05:00:00.000Z");
    const jul15 = lastCompletedBusinessDay(hours, afterJul15Close);
    const jul15UtcStart = new Date(Date.UTC(2026, 6, 15, 0, 0, 0));
    const jul15UtcEnd = new Date(Date.UTC(2026, 6, 16, 0, 0, 0));
    const jul15Eat = getAppDayBounds(0, new Date("2026-07-15T12:00:00.000Z"));
    const jul15Biz = await paidCount(BABA_ID, jul15.start, jul15.end);
    const jul15Utc = await paidCount(BABA_ID, jul15UtcStart, jul15UtcEnd);
    const jul15EatCount = await paidCount(BABA_ID, jul15Eat.start, jul15Eat.end);
    console.log(`  Jul 15 recap window ${jul15.start.toISOString()} → ${jul15.end.toISOString()}`);
    console.log(`  paid orders  Jul 15 business 10:00–02:00: ${jul15Biz}`);
    console.log(`  paid orders  UTC midnight–midnight Jul 15: ${jul15Utc}`);
    console.log(`  paid orders  EAT calendar Jul 15: ${jul15EatCount}`);
    if (jul15Biz !== jul15Utc) pass("Live Jul 15 counts differ vs UTC midnight");
    else fail("Expected different count vs UTC midnight on Jul 15");
    if (jul15Biz !== jul15EatCount) pass("Live Jul 15 counts differ vs EAT midnight–midnight");
    else fail("Expected Jul 15 business day to differ from EAT calendar day");

    // Richer day for the card: just after 2:00 AM close on 25 Jul.
    const afterClose = new Date("2026-07-25T00:30:00.000Z");
    const window = lastCompletedBusinessDay(hours, afterClose);
    if (
      window.start.toISOString() === "2026-07-24T07:00:00.000Z" &&
      window.end.toISOString() === "2026-07-24T23:00:00.000Z"
    ) {
      pass("Jul 24 business day is 10:00 EAT → 02:00 EAT next day, not UTC midnight");
    } else {
      fail("Jul 24 overnight window", `${window.start.toISOString()} → ${window.end.toISOString()}`);
    }

    const daily = await fetchDailyRecap(admin, withHours, afterClose);
    const monthly = await fetchMonthlyRecap(admin, withHours, new Date("2026-08-14T12:00:00.000Z"));

    console.log("\n===== DAILY RECAP (dashboard card) =====");
    console.log("headline:", daily.headline);
    console.log("body:", daily.body);
    console.log("orders:", daily.kpi.orders, "revenue:", daily.kpi.revenue, "top:", daily.kpi.topItemName);
    console.log("vs prior day:", daily.comparison);
    console.log("window:", daily.window.start.toISOString(), "→", daily.window.end.toISOString(), daily.window.hoursLabel);

    console.log("\n===== MONTHLY RECAP (dashboard card) =====");
    console.log("headline:", monthly.headline);
    console.log("body:", monthly.body);
    console.log("orders:", monthly.kpi.orders, "revenue:", monthly.kpi.revenue);
    console.log("top items:", monthly.topItems.map((i) => `${i.name} ×${i.quantity}`).join(", ") || "—");
    console.log("best day:", monthly.bestDay);
    console.log("vs", monthly.previousMonthLabel, monthly.comparison);

    if (daily.kpi.orders > 0) pass("Daily recap has real paid orders");
    else fail("Daily recap orders");
    if (monthly.kpi.orders > 0) pass("Monthly recap has real paid orders");
    else fail("Monthly recap orders");
  } finally {
    const { error: restoreErr } = await admin.from("restaurants").update(originalHours).eq("id", BABA_ID);
    if (restoreErr) fail("Restore Baba hours", restoreErr.message);
    else pass("Restored Baba hours (null = 24h calendar days)");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

void main();
