/**
 * Verify Hilaac Platform link is gated behind profiles.is_platform_admin.
 *
 *   node scripts/verify-platform-link-gate.mjs
 *
 * Checks:
 * 1) Source: AdminUserMenu only renders the link when isPlatformAdmin is true
 * 2) Layout passes profile.is_platform_admin === true (strict)
 * 3) Live DB: non-admin owner has is_platform_admin = false
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const NON_ADMIN_EMAIL = process.env.VERIFY_NON_ADMIN_EMAIL || "yussufsafari9@gmail.com";
const ADMIN_EMAIL = process.env.VERIFY_ADMIN_EMAIL || "yusufyare1444@hotmail.com";

const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

let passed = 0;
let failed = 0;
function pass(n, d = "") {
  passed += 1;
  console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  failed += 1;
  console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
}

const menuSrc = readFileSync(resolve("components/admin/admin-user-menu.tsx"), "utf8");
const layoutSrc = readFileSync(resolve("app/admin/[slug]/layout.tsx"), "utf8");

if (
  menuSrc.includes("{isPlatformAdmin && (") &&
  menuSrc.includes("Hilaac Platform") &&
  menuSrc.includes("isPlatformAdmin = false")
) {
  pass("source_gate", "AdminUserMenu renders Platform link only when isPlatformAdmin");
} else {
  fail("source_gate", "AdminUserMenu missing strict isPlatformAdmin gate");
}

if (layoutSrc.includes("isPlatformAdmin={profile.is_platform_admin === true}")) {
  pass("layout_prop", "layout passes strict === true (not truthy coercion)");
} else {
  fail("layout_prop", "layout does not pass profile.is_platform_admin === true");
}

if (!SUPABASE_URL || !SERVICE) {
  fail("db_env", "Missing Supabase URL or service role key");
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) {
  fail("list_users", listErr.message);
} else {
  const nonAdminAuth = users.users.find(
    (u) => u.email?.toLowerCase() === NON_ADMIN_EMAIL.toLowerCase()
  );
  const adminAuth = users.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  if (!nonAdminAuth) {
    fail("non_admin_user", `No auth user for ${NON_ADMIN_EMAIL}`);
  } else {
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, full_name, role, is_platform_admin")
      .eq("id", nonAdminAuth.id)
      .maybeSingle();
    if (error || !profile) {
      fail("non_admin_profile", error?.message || "profile missing");
    } else if (profile.is_platform_admin === true) {
      fail(
        "non_admin_flag",
        `${NON_ADMIN_EMAIL} unexpectedly has is_platform_admin=true — Platform link WOULD show`
      );
    } else {
      pass(
        "non_admin_flag",
        `${NON_ADMIN_EMAIL} is_platform_admin=${profile.is_platform_admin} → Platform link absent`
      );
    }
  }

  if (!adminAuth) {
    fail("admin_user", `No auth user for ${ADMIN_EMAIL}`);
  } else {
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, is_platform_admin")
      .eq("id", adminAuth.id)
      .maybeSingle();
    if (error || !profile) {
      fail("admin_profile", error?.message || "profile missing");
    } else if (profile.is_platform_admin === true) {
      pass("admin_flag", `${ADMIN_EMAIL} is_platform_admin=true → Platform link shown`);
    } else {
      fail("admin_flag", `${ADMIN_EMAIL} missing is_platform_admin=true`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
