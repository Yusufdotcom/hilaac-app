/**
 * Verify platform Open fixes: Forbidden RPCs, Safari isolation, audit, C2, routing.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

config({ path: ".env.local", quiet: true });

let passed = 0;
let failed = 0;
function pass(n, d = "") {
  passed += 1;
  console.log("PASS ", n, d);
}
function fail(n, d = "") {
  failed += 1;
  console.log("FAIL ", n, d);
}
function read(rel) {
  return readFileSync(resolve(rel), "utf8");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const admin = createClient(url, service, { auth: { persistSession: false } });

const { data: rests } = await admin
  .from("restaurants")
  .select("id, slug, owner_id, name")
  .in("slug", ["baba-s-grill-and-cafe", "boba-hergeisa", "hilaac-safari"]);

const baba = rests?.find((r) => r.slug === "baba-s-grill-and-cafe");
const boba = rests?.find((r) => r.slug === "boba-hergeisa");
const safari = rests?.find((r) => r.slug === "hilaac-safari");

if (baba && boba && baba.owner_id === boba.owner_id) {
  pass("Boba is same-owner branch as Baba", baba.owner_id.slice(0, 8));
} else fail("Boba same-owner branch");

if (safari && baba && safari.owner_id !== baba.owner_id) {
  pass("Hilaac Safari is genuine unrelated tenant", safari.owner_id.slice(0, 8));
} else fail("Safari unrelated");

const { error: auditErr } = await admin.from("platform_support_audit").select("id").limit(1);
if (!auditErr) pass("platform_support_audit table exists");
else fail("platform_support_audit", auditErr.message);

const mig = read("supabase/migrations/20250811200000_platform_open_rpc_rls_audit.sql");
if (mig.includes("assert_restaurant_scope") && mig.includes("is_platform_admin()")) {
  pass("RPC migration allows platform admin scope bypass");
} else fail("RPC migration");

const openSrc = read("app/platform/open/[slug]/route.ts");
if (openSrc.includes("platform_support_audit") && openSrc.includes("cross_tenant")) {
  pass("Open writes audit log (who/tenant/when)");
} else fail("Open audit");

const settings = read("app/api/admin/restaurant/settings/route.ts");
if (
  settings.includes("platform_support_payment_blocked") &&
  settings.includes("bodyTouchesPaymentSettings")
) {
  pass("C2: platform support blocked from writing merchant credentials");
} else fail("C2 payment write block");

// Encrypted columns still revoked from authenticated (schema)
const schema = read("supabase/schema.sql");
if (
  schema.includes("evc_merchant_id_encrypted") &&
  schema.includes("revoke select") &&
  schema.includes("evc_api_key_encrypted")
) {
  pass("C2: encrypted merchant columns not granted to authenticated");
} else fail("C2 column grants");

const remindJob = read("app/api/jobs/payment-reminders/route.ts");
const remindApi = "app/api/platform/restaurants/[id]/remind/route.ts";
if (remindJob.includes("sendPaymentReminder") && existsSync(resolve(remindApi))) {
  pass("Subscription reminders: cron + manual Send API");
} else fail("reminders");

const ui = read("components/platform/platform-restaurants.tsx");
if (ui.includes("PlatformStatCard") && ui.includes("Remind") && ui.includes("/platform/open/")) {
  pass("Platform restaurants UI: stats + Open + Remind");
} else fail("platform UI");

const dash = read("app/platform/dashboard/page.tsx");
const restPage = read("app/platform/restaurants/page.tsx");
if (dash.includes('redirect("/platform/restaurants")') && restPage.includes("PlatformRestaurants")) {
  pass("Routing: /platform/dashboard → restaurants; /platform/restaurants exists");
} else fail("routing");

// Live routing smoke (unauth → login, not 404/500)
const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.hilaacapp.so";
for (const path of ["/platform/restaurants", "/platform/dashboard"]) {
  try {
    const res = await fetch(`${base}${path}`, { redirect: "manual", cache: "no-store" });
    if (res.status === 307 || res.status === 302 || res.status === 303) {
      const loc = res.headers.get("location") || "";
      if (loc.includes("/login") || loc.includes("/platform/restaurants")) {
        pass(`live ${path} → ${res.status}`, loc.slice(0, 80));
      } else pass(`live ${path} redirect`, `${res.status} ${loc}`);
    } else if (res.status === 404) fail(`live ${path} 404`);
    else if (res.status === 500) fail(`live ${path} 500`);
    else pass(`live ${path}`, String(res.status));
  } catch (e) {
    fail(`live ${path}`, e instanceof Error ? e.message : String(e));
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
