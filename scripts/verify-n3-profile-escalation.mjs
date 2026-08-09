/**
 * N3: Authenticated user cannot self-escalate role / restaurant_id / is_active.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

config({ path: ".env.local" });

function pass(name) {
  console.log("PASS ", name);
}
function fail(name, detail) {
  console.error("FAIL ", name, detail ?? "");
  process.exitCode = 1;
}

const mig = readFileSync(
  resolve("supabase/migrations/20250809121000_profiles_freeze_privileged_columns.sql"),
  "utf8"
);
if (mig.includes("profiles_prevent_privilege_escalation") && mig.includes("BEFORE UPDATE")) {
  pass("migration defines privilege-escalation trigger");
} else {
  fail("migration missing trigger");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = process.env.N3_TEST_EMAIL?.trim();
const password = process.env.N3_TEST_PASSWORD?.trim();

if (!url || !anon || !service) {
  console.log("SKIP live escalation — missing Supabase env");
  console.log("N3 profile escalation checks done");
  process.exit(process.exitCode ?? 0);
}

if (!email || !password) {
  console.log("SKIP live self-escalate — set N3_TEST_EMAIL / N3_TEST_PASSWORD");
  console.log("N3 profile escalation checks done");
  process.exit(process.exitCode ?? 0);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const userClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: signErr } = await userClient.auth.signInWithPassword({ email, password });
if (signErr) {
  fail("sign-in for N3 test", signErr.message);
  console.log("N3 profile escalation checks done");
  process.exit(process.exitCode ?? 0);
}

const {
  data: { user },
} = await userClient.auth.getUser();
if (!user) {
  fail("no user after sign-in");
  process.exit(1);
}

const { data: before } = await userClient
  .from("profiles")
  .select("role, restaurant_id, is_active")
  .eq("id", user.id)
  .maybeSingle();

const { error: roleErr } = await userClient
  .from("profiles")
  .update({ role: before?.role === "owner" ? "manager" : "owner" })
  .eq("id", user.id);

if (roleErr) {
  pass(`self role escalate blocked — ${roleErr.message}`);
} else {
  await admin.from("profiles").update({ role: before?.role }).eq("id", user.id);
  fail("self role escalate", "UPDATE succeeded — apply migration 20250809121000");
}

const fakeRestaurant = "00000000-0000-4000-8000-000000000099";
const { error: tenantErr } = await userClient
  .from("profiles")
  .update({ restaurant_id: fakeRestaurant })
  .eq("id", user.id);

if (tenantErr) {
  pass(`self restaurant_id escalate blocked — ${tenantErr.message}`);
} else {
  await admin
    .from("profiles")
    .update({ restaurant_id: before?.restaurant_id })
    .eq("id", user.id);
  fail("self restaurant_id escalate", "UPDATE succeeded — apply migration 20250809121000");
}

const { error: activeErr } = await userClient
  .from("profiles")
  .update({ is_active: false })
  .eq("id", user.id);

if (activeErr) {
  pass(`self is_active change blocked — ${activeErr.message}`);
} else {
  await admin.from("profiles").update({ is_active: true }).eq("id", user.id);
  fail("self is_active change", "UPDATE succeeded — apply migration 20250809121000");
}

await userClient.auth.signOut();
console.log("N3 profile escalation checks done");
