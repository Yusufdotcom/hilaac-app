/**
 * Live attack-style verification for N2 / N3 / N4 after migrations applied.
 */
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

function env(k) {
  let v = process.env[k] ?? "";
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const service = env("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!url || !service || !anonKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

const cleanupUserIds = [];

async function createStaffUser(email, password, restaurantId, role) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(error?.message ?? "createUser failed");
  cleanupUserIds.push(created.user.id);
  const { error: profileErr } = await admin.from("profiles").upsert({
    id: created.user.id,
    restaurant_id: restaurantId,
    role,
    full_name: `N-test ${role}`,
    is_active: true,
  });
  if (profileErr) throw new Error(profileErr.message);
  return created.user.id;
}

async function clientAs(email, password) {
  const c = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return c;
}

const { data: restaurantA } = await admin
  .from("restaurants")
  .select("id, slug, owner_id")
  .eq("slug", "baba-s-grill-and-cafe")
  .maybeSingle();

if (!restaurantA?.id) {
  console.error("Restaurant Baba's Grill not found");
  process.exit(1);
}

const { data: restaurantB } = await admin
  .from("restaurants")
  .select("id, slug")
  .neq("id", restaurantA.id)
  .limit(1)
  .maybeSingle();

const stamp = Date.now().toString(36);
const waiterEmail = `n3-waiter-${stamp}@test.hilaac.local`;
const managerEmail = `n3-manager-${stamp}@test.hilaac.local`;
const password = `N3test-${randomUUID().slice(0, 8)}!`;

console.log("\n=== N3 privilege escalation ===");
try {
  const waiterId = await createStaffUser(waiterEmail, password, restaurantA.id, "waiter");
  const managerId = await createStaffUser(managerEmail, password, restaurantA.id, "manager");

  const waiter = await clientAs(waiterEmail, password);
  const { data: before } = await waiter
    .from("profiles")
    .select("role, restaurant_id, is_active")
    .eq("id", waiterId)
    .maybeSingle();

  const { error: escalateErr } = await waiter
    .from("profiles")
    .update({ role: "owner" })
    .eq("id", waiterId);

  if (escalateErr) {
    pass("self role escalate to owner blocked", escalateErr.message);
  } else {
    await admin.from("profiles").update({ role: before?.role }).eq("id", waiterId);
    fail("self role escalate to owner blocked", "UPDATE succeeded");
  }

  const { error: tenantErr } = await waiter
    .from("profiles")
    .update({ restaurant_id: "00000000-0000-4000-8000-000000000099" })
    .eq("id", waiterId);
  if (tenantErr) {
    pass("self restaurant_id change blocked", tenantErr.message);
  } else {
    await admin.from("profiles").update({ restaurant_id: restaurantA.id }).eq("id", waiterId);
    fail("self restaurant_id change blocked", "UPDATE succeeded");
  }

  // Legitimate manager promotion of waiter → cashier (non-owner)
  const manager = await clientAs(managerEmail, password);
  const { error: promoteErr } = await manager
    .from("profiles")
    .update({ role: "cashier" })
    .eq("id", waiterId);

  if (!promoteErr) {
    const { data: after } = await admin
      .from("profiles")
      .select("role")
      .eq("id", waiterId)
      .maybeSingle();
    if (after?.role === "cashier") {
      pass("manager can promote waiter → cashier");
    } else {
      fail("manager can promote waiter → cashier", `role=${after?.role}`);
    }
  } else {
    fail("manager can promote waiter → cashier", promoteErr.message);
  }

  void managerId;
} catch (e) {
  fail("N3 setup/run", e instanceof Error ? e.message : String(e));
}

console.log("\n=== N4 anon demo RPC ===");
{
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.rpc("create_demo_restaurant");
  if (error) {
    const msg = (error.message || "").toLowerCase();
    const permission =
      msg.includes("permission") ||
      msg.includes("not allowed") ||
      msg.includes("denied") ||
      error.code === "42501" ||
      error.code === "PGRST202" ||
      error.code === "42883";
    const fk = msg.includes("foreign key") || msg.includes("fk_restaurants");
    if (permission && !fk) {
      pass("anon create_demo_restaurant rejected by privilege", error.message);
    } else if (fk) {
      fail(
        "anon create_demo_restaurant rejected by privilege",
        `still FK incidental block: ${error.message}`
      );
    } else {
      // PostgREST often: "permission denied for function create_demo_restaurant"
      if (msg.includes("permission denied for function") || msg.includes("execute")) {
        pass("anon create_demo_restaurant rejected by privilege", error.message);
      } else {
        fail("anon create_demo_restaurant rejected by privilege", error.message);
      }
    }
  } else {
    fail("anon create_demo_restaurant rejected by privilege", `OPEN returned ${data}`);
  }
}

console.log("\n=== N2 encrypted / billing column UPDATE ===");
try {
  // Reuse a manager session (authenticated, is_manager_or_owner) — do not steal owner_id.
  const n2Email = `n2-mgr-${stamp}@test.hilaac.local`;
  await createStaffUser(n2Email, password, restaurantA.id, "manager");
  const mgrClient = await clientAs(n2Email, password);

  const targetB = restaurantB?.id;
  if (targetB) {
    const { data: crossData, error: crossEncErr } = await mgrClient
      .from("restaurants")
      .update({
        evc_merchant_id_encrypted: "ATTACK_CIPHERTEXT",
        evc_api_key_encrypted: "ATTACK_KEY",
      })
      .eq("id", targetB)
      .select("id");

    if (crossEncErr) {
      pass(
        "authenticated UPDATE Restaurant B encrypted columns rejected",
        crossEncErr.message
      );
    } else if (!crossData?.length) {
      pass(
        "authenticated UPDATE Restaurant B encrypted columns rejected",
        "0 rows (RLS) — no write"
      );
    } else {
      fail(
        "authenticated UPDATE Restaurant B encrypted columns rejected",
        "UPDATE wrote rows"
      );
    }
  } else {
    console.log("SKIP cross-tenant encrypted UPDATE — no second restaurant");
  }

  const { data: ownEncData, error: ownEncErr } = await mgrClient
    .from("restaurants")
    .update({
      evc_merchant_id_encrypted: "ATTACK_OWN",
      edahab_api_key_encrypted: "ATTACK_OWN",
    })
    .eq("id", restaurantA.id)
    .select("id");

  if (ownEncErr) {
    pass("authenticated UPDATE own restaurant encrypted columns rejected", ownEncErr.message);
  } else if (!ownEncData?.length) {
    pass(
      "authenticated UPDATE own restaurant encrypted columns rejected",
      "0 rows — no write"
    );
  } else {
    fail("authenticated UPDATE own restaurant encrypted columns rejected", "UPDATE wrote rows");
  }

  const { data: beforeTier } = await admin
    .from("restaurants")
    .select("subscription_tier, subscription_status")
    .eq("id", restaurantA.id)
    .maybeSingle();

  const { data: billingData, error: billingErr } = await mgrClient
    .from("restaurants")
    .update({ subscription_tier: "pro", subscription_status: "active" })
    .eq("id", restaurantA.id)
    .select("id");

  const { data: afterTier } = await admin
    .from("restaurants")
    .select("subscription_tier, subscription_status")
    .eq("id", restaurantA.id)
    .maybeSingle();

  const tierChanged =
    afterTier?.subscription_tier !== beforeTier?.subscription_tier ||
    afterTier?.subscription_status !== beforeTier?.subscription_status;

  if (billingErr) {
    pass("authenticated UPDATE subscription_* columns rejected", billingErr.message);
  } else if (!billingData?.length && !tierChanged) {
    pass("authenticated UPDATE subscription_* columns rejected", "0 rows / unchanged");
  } else if (tierChanged) {
    // restore
    await admin
      .from("restaurants")
      .update({
        subscription_tier: beforeTier.subscription_tier,
        subscription_status: beforeTier.subscription_status,
      })
      .eq("id", restaurantA.id);
    fail("authenticated UPDATE subscription_* columns rejected", "tier/status changed");
  } else {
    fail("authenticated UPDATE subscription_* columns rejected", "unexpected success");
  }

  // Legitimate Admin API path: service_role can write encrypted columns
  const { data: beforeEnc } = await admin
    .from("restaurants")
    .select("evc_merchant_id_encrypted")
    .eq("id", restaurantA.id)
    .maybeSingle();

  const { error: svcEncErr } = await admin
    .from("restaurants")
    .update({
      evc_merchant_id_encrypted: beforeEnc?.evc_merchant_id_encrypted ?? null,
    })
    .eq("id", restaurantA.id);

  if (!svcEncErr) {
    pass("service_role can UPDATE encrypted columns (settings API path)");
  } else {
    fail("service_role can UPDATE encrypted columns", svcEncErr.message);
  }

  // Non-secret columns still updatable by manager (Payment Settings UX / general settings)
  const { data: beforeHotline } = await admin
    .from("restaurants")
    .select("takeaway_hotline")
    .eq("id", restaurantA.id)
    .maybeSingle();

  const { error: hotlineErr } = await mgrClient
    .from("restaurants")
    .update({ takeaway_hotline: beforeHotline?.takeaway_hotline ?? "0610000000" })
    .eq("id", restaurantA.id);

  if (!hotlineErr) {
    pass("manager can still UPDATE non-secret restaurant columns");
  } else {
    fail("manager can still UPDATE non-secret restaurant columns", hotlineErr.message);
  }
} catch (e) {
  fail("N2 setup/run", e instanceof Error ? e.message : String(e));
}

console.log("\n=== cleanup ===");
for (const id of cleanupUserIds) {
  await admin.from("profiles").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);
}
console.log("cleanup deleted", cleanupUserIds.length, "users");

console.log(`\nN2/N3/N4 live: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
