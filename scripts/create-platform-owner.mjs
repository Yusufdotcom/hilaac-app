/**
 * One-time setup: dedicated Platform Super Admin account.
 *
 * - Own email/password (not tied to any restaurant owner)
 * - profiles.is_platform_admin = true
 * - profiles.restaurant_id = null (appears in no tenant staff list)
 * - Does NOT set restaurants.owner_id
 *
 * Usage:
 *   node scripts/create-platform-owner.mjs
 *   node scripts/create-platform-owner.mjs --email=you@domain.com --password='...'
 *
 * Env (optional): PLATFORM_OWNER_EMAIL, PLATFORM_OWNER_PASSWORD, PLATFORM_OWNER_NAME
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";

config({ path: ".env.local" });

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const email = (
  arg("email") ||
  process.env.PLATFORM_OWNER_EMAIL ||
  "platform@hilaacapp.so"
).trim().toLowerCase();
const password =
  arg("password") ||
  process.env.PLATFORM_OWNER_PASSWORD ||
  `Hp!${randomBytes(12).toString("base64url")}`;
const fullName = (arg("name") || process.env.PLATFORM_OWNER_NAME || "Hilaac Platform").trim();

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(target) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

const existing = await findUserByEmail(email);
let userId;

if (existing) {
  userId = existing.id;
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, platform_owner: true },
  });
  if (updErr) throw updErr;
  console.log("Updated existing auth user", userId);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, platform_owner: true },
  });
  if (error) throw error;
  userId = data.user.id;
  console.log("Created auth user", userId);
}

// Ensure profile: platform-only (no restaurant_id), flag on. Role required by schema.
const { data: profile, error: profErr } = await admin
  .from("profiles")
  .select("id, restaurant_id, is_platform_admin, role")
  .eq("id", userId)
  .maybeSingle();
if (profErr) throw profErr;

if (!profile) {
  const { error: insErr } = await admin.from("profiles").insert({
    id: userId,
    restaurant_id: null,
    role: "owner",
    full_name: fullName,
    is_active: true,
    is_platform_admin: true,
  });
  if (insErr) throw insErr;
  console.log("Inserted platform-only profile");
} else {
  const { error: upErr } = await admin
    .from("profiles")
    .update({
      restaurant_id: null,
      role: "owner",
      full_name: fullName,
      is_active: true,
      is_platform_admin: true,
    })
    .eq("id", userId);
  if (upErr) throw upErr;
  console.log("Updated profile → is_platform_admin=true, restaurant_id=null");
}

// Safety: must not own any restaurant
const { data: owned, error: ownErr } = await admin
  .from("restaurants")
  .select("id, slug")
  .eq("owner_id", userId);
if (ownErr) throw ownErr;
if (owned?.length) {
  console.error(
    "REFUSING to leave ownership in place. Detach owner_id manually first:",
    owned.map((r) => r.slug)
  );
  process.exit(2);
}

const { count: staffCount } = await admin
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .eq("id", userId)
  .not("restaurant_id", "is", null);

console.log("\n=== Platform Owner ready ===");
console.log("email:", email);
console.log("password:", password);
console.log("user_id:", userId);
console.log("is_platform_admin: true");
console.log("restaurant_id: null");
console.log("owned restaurants: 0");
console.log("profiles with restaurant_id:", staffCount ?? 0);
console.log("\nNext: log in → enroll MFA → /platform/restaurants");
console.log("Store this password in your secrets manager; it will not be shown again.");
