/**
 * Step 1.2 — Verify rollback baseline + SQL, optionally compare to live DB.
 *
 * Usage:
 *   node scripts/verify-tier-migration-rollback.mjs          # offline: baseline ↔ SQL
 *   node scripts/verify-tier-migration-rollback.mjs --live   # also compare live DB to baseline
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const LIVE = process.argv.includes("--live");
const ROOT = resolve(process.cwd(), "scripts");
const BASELINE_PATH = resolve(ROOT, "tier-migration-baseline.json");
const ROLLBACK_PATH = resolve(ROOT, "tier-migration-rollback.sql");
const REQUIRED_SLUGS = ["baba-s-grill-and-cafe", "boba-hergeisa", "hilaac-safari"];

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

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseRollbackSql(sql) {
  const updates = [];
  const blocks = sql.split(/^UPDATE public\.restaurants/gm).slice(1);
  for (const block of blocks) {
    const slugMatch = block.match(/WHERE slug = '([^']+)'/);
    const tierMatch = block.match(/subscription_tier = '([^']+)'/);
    const statusMatch = block.match(/subscription_status = '([^']+)'/);
    const endMatch = block.match(/subscription_end_date = '([^']+)'/);
    const paymentMatch = block.match(/payment_mode = '([^']+)'/);
    if (!slugMatch || !tierMatch || !statusMatch || !endMatch || !paymentMatch) continue;
    updates.push({
      slug: slugMatch[1],
      subscription_tier: tierMatch[1],
      subscription_status: statusMatch[1],
      subscription_end_date: endMatch[1],
      payment_mode: paymentMatch[1],
    });
  }
  return updates;
}

const baseline = readJson(BASELINE_PATH);
if (!baseline?.restaurants?.length) {
  fail("baseline.json exists", "Run: node scripts/capture-tier-migration-baseline.mjs");
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(1);
}
pass("baseline.json loaded", baseline.captured_at ?? "no timestamp");

if (baseline.restaurants.length !== 3) {
  fail("baseline has 3 restaurants", String(baseline.restaurants.length));
} else {
  pass("baseline has 3 restaurants");
}

for (const slug of REQUIRED_SLUGS) {
  if (baseline.restaurants.some((r) => r.slug === slug)) pass(`baseline includes ${slug}`);
  else fail(`baseline includes ${slug}`);
}

for (const r of baseline.restaurants) {
  if (r.subscription_end_date && r.subscription_tier && r.subscription_status && r.payment_mode) {
    pass(`baseline fields complete for ${r.slug}`);
  } else {
    fail(`baseline fields complete for ${r.slug}`, JSON.stringify(r));
  }
}

if (!existsSync(ROLLBACK_PATH)) {
  fail("rollback.sql exists");
} else {
  pass("rollback.sql exists");
  const sql = readFileSync(ROLLBACK_PATH, "utf8");
  if (sql.includes("BEGIN;") && sql.includes("COMMIT;")) pass("rollback.sql uses transaction");
  else fail("rollback.sql transaction wrapper");

  const parsed = parseRollbackSql(sql);
  if (parsed.length === 3) pass("rollback.sql has 3 UPDATE statements");
  else fail("rollback.sql UPDATE count", String(parsed.length));

  for (const expected of baseline.restaurants) {
    const found = parsed.find((u) => u.slug === expected.slug);
    if (!found) {
      fail(`rollback SQL includes ${expected.slug}`);
      continue;
    }
    const same =
      found.subscription_tier === expected.subscription_tier &&
      found.subscription_status === expected.subscription_status &&
      found.subscription_end_date === expected.subscription_end_date &&
      found.payment_mode === expected.payment_mode;
    if (same) pass(`rollback SQL matches baseline for ${expected.slug}`);
    else {
      fail(`rollback SQL matches baseline for ${expected.slug}`, JSON.stringify({ found, expected }));
    }
  }

  if (sql.includes("subscription_end_date")) pass("rollback restores subscription_end_date");
  else fail("rollback restores subscription_end_date");
}

async function fetchLiveRows() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    try {
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await admin
        .from("restaurants")
        .select("id, slug, subscription_tier, subscription_status, subscription_end_date, payment_mode")
        .in("slug", REQUIRED_SLUGS)
        .order("slug");
      if (!error) return data ?? [];
      console.warn("REST live fetch failed:", error.message);
    } catch (err) {
      console.warn("REST live fetch failed:", err instanceof Error ? err.message : String(err));
    }
  }

  const { default: pg } = await import("pg");
  const password =
    process.env.SUPABASE_DB_PASSWORD?.trim() || process.env.POSTGRES_PASSWORD?.trim();
  const poolerPath = resolve(process.cwd(), "supabase/.temp/pooler-url");
  if (!password || !existsSync(poolerPath)) {
    throw new Error("Missing pooler credentials for live check fallback");
  }
  const pooler = readFileSync(poolerPath, "utf8").trim();
  const u = new URL(pooler);
  u.password = password;
  const client = new pg.Client({
    connectionString: u.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select id::text as id, slug, subscription_tier::text as subscription_tier,
              subscription_status::text as subscription_status,
              subscription_end_date::text as subscription_end_date,
              payment_mode::text as payment_mode
       from public.restaurants
       where slug = any($1::text[])
       order by slug`,
      [REQUIRED_SLUGS]
    );
    return rows;
  } finally {
    await client.end();
  }
}

if (LIVE) {
  try {
    const data = await fetchLiveRows();
    pass("live DB fetch", `${data.length} rows`);
    for (const expected of baseline.restaurants) {
      const live = data.find((r) => r.slug === expected.slug);
      if (!live) {
        fail(`live row exists for ${expected.slug}`);
        continue;
      }
      const same =
        live.subscription_tier === expected.subscription_tier &&
        live.subscription_status === expected.subscription_status &&
        live.subscription_end_date === expected.subscription_end_date &&
        live.payment_mode === expected.payment_mode;
      if (same) pass(`live DB matches baseline for ${expected.slug}`);
      else {
        fail(`live DB matches baseline for ${expected.slug}`, JSON.stringify({ live, expected }));
      }
    }
  } catch (err) {
    fail("live check", err instanceof Error ? err.message : String(err));
  }
} else {
  console.log("(Skipping live DB check — pass --live to compare production state to baseline)");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
