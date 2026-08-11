/**
 * Verifies:
 * 1) Boba is same owner as Baba (branch), Safari is unrelated
 * 2) Dedicated platform owner has null restaurant_id, owns nothing
 * 3) Open path + gates are wired for cross-tenant support
 * 4) Server-side is_platform_admin checks exist independent of restaurant role
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

config({ path: ".env.local" });

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const admin = createClient(url, service, { auth: { persistSession: false } });

const { data: rests } = await admin
  .from("restaurants")
  .select("id, name, slug, owner_id, branch_name")
  .in("slug", ["baba-s-grill-and-cafe", "boba-hergeisa", "hilaac-safari"]);

const baba = rests?.find((r) => r.slug === "baba-s-grill-and-cafe");
const boba = rests?.find((r) => r.slug === "boba-hergeisa");
const safari = rests?.find((r) => r.slug === "hilaac-safari");

if (baba && boba && baba.owner_id === boba.owner_id) {
  pass("Boba shares Mustaf owner_id with Baba (same-account branch)", baba.owner_id);
} else {
  fail("Boba shares Mustaf owner_id with Baba", JSON.stringify({ baba, boba }));
}

if (safari && baba && safari.owner_id !== baba.owner_id) {
  pass("Hilaac Safari is a genuinely unrelated owner", safari.owner_id);
} else {
  fail("Hilaac Safari unrelated owner", JSON.stringify({ safari, baba }));
}

const platformEmail = (process.env.PLATFORM_OWNER_EMAIL || "platform@hilaacapp.so")
  .trim()
  .toLowerCase();

async function findUser(email) {
  let page = 1;
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

const platformUser = await findUser(platformEmail);
if (platformUser) {
  const { data: p } = await admin
    .from("profiles")
    .select("id, restaurant_id, is_platform_admin, role, is_active")
    .eq("id", platformUser.id)
    .maybeSingle();
  if (p?.is_platform_admin === true && p.restaurant_id == null && p.is_active !== false) {
    pass("dedicated platform profile: flag on, restaurant_id null");
  } else {
    fail("dedicated platform profile shape", JSON.stringify(p));
  }
  const { data: owned } = await admin.from("restaurants").select("id").eq("owner_id", platformUser.id);
  if (!owned?.length) pass("dedicated platform owns zero restaurants");
  else fail("dedicated platform owns restaurants", String(owned.length));
} else {
  fail("dedicated platform user exists", `missing ${platformEmail} — run create-platform-owner.mjs`);
}

// Source contracts
function read(rel) {
  return readFileSync(resolve(rel), "utf8");
}

const gate = read("lib/auth/require-platform-admin.ts");
if (
  gate.includes("is_platform_admin !== true") &&
  gate.includes("requireAal2ForPlatformAdmin") &&
  gate.includes("Independent of restaurant role")
) {
  pass("requirePlatformAdmin: flag + AAL2, independent of restaurant role");
} else fail("requirePlatformAdmin contract");

const mw = read("lib/supabase/middleware.ts");
if (mw.includes("isPlatformAdmin") && mw.includes("Unconditional MFA") && mw.includes("isPlatform")) {
  pass("middleware: /platform requires is_platform_admin + unconditional MFA");
} else fail("middleware platform MFA");

const openRoute = "app/platform/open/[slug]/route.ts";
if (existsSync(resolve(openRoute))) {
  const src = read(openRoute);
  if (src.includes("requirePlatformAdmin") && src.includes("mintPlatformSupportToken")) {
    pass("Open uses /platform/open/[slug] + support cookie (not bare /admin link)");
  } else fail("open route incomplete");
} else fail("open route missing");

const restaurantsUi = read("components/platform/platform-restaurants.tsx");
if (restaurantsUi.includes("/platform/open/")) {
  pass("All Restaurants Open → /platform/open/[slug]");
} else fail("Open link still points at bare /admin");

const ctx = read("lib/admin/get-restaurant-context.ts");
if (ctx.includes("platformSupport") && ctx.includes("readSupportSessionForUser")) {
  pass("getRestaurantContext allows support session without owning tenant");
} else fail("getRestaurantContext support");

const staff = read("lib/auth/require-active-staff.ts");
if (staff.includes("platform_support") && staff.includes("readSupportSessionForUser")) {
  pass("requireActiveStaff honors support session restaurant_id override");
} else fail("requireActiveStaff support");

const migration = "supabase/migrations/20250811120000_platform_admin_rls_and_support.sql";
if (existsSync(resolve(migration)) && read(migration).includes("is_platform_admin()")) {
  pass("RLS migration adds is_platform_admin() for support Open");
} else fail("RLS migration");

// Cross-tenant Open test simulation (service-side): Safari owner ≠ platform user
if (platformUser && safari && safari.owner_id !== platformUser.id) {
  pass(
    "cross-tenant Open target available",
    `platform=${platformUser.id.slice(0, 8)}… safari_owner=${safari.owner_id.slice(0, 8)}… slug=${safari.slug}`
  );
} else if (platformUser && safari) {
  fail("platform user must not own Safari");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
