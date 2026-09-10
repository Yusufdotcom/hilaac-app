/**
 * Step 1.2 — Capture live subscription baseline via Postgres pooler
 * (falls back when REST API host DNS fails).
 *
 * Usage: node scripts/capture-tier-migration-baseline.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const SLUGS = ["baba-s-grill-and-cafe", "boba-hergeisa", "hilaac-safari"];
const ROOT = resolve(process.cwd(), "scripts");
const BASELINE_PATH = resolve(ROOT, "tier-migration-baseline.json");
const ROLLBACK_PATH = resolve(ROOT, "tier-migration-rollback.sql");

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildRollbackSql(baseline) {
  const lines = [
    "-- Step 1.2 rollback: restore live tenants to pre-migration subscription state.",
    `-- Captured at: ${baseline.captured_at}`,
    "-- NEVER change subscription_end_date during forward tier migration.",
    "--",
    "-- Apply:",
    "--   node scripts/supabase-db.mjs db query --linked -f scripts/tier-migration-rollback.sql",
    "-- Verify after apply:",
    "--   node scripts/verify-tier-migration-rollback.mjs --live",
    "",
    "BEGIN;",
    "",
  ];

  for (const r of baseline.restaurants) {
    lines.push(`-- ${r.name} (${r.slug})`);
    lines.push("UPDATE public.restaurants SET");
    lines.push(`  subscription_tier = ${sqlLiteral(r.subscription_tier)}::public.subscription_tier,`);
    lines.push(`  subscription_status = ${sqlLiteral(r.subscription_status)}::public.subscription_status,`);
    lines.push(`  subscription_end_date = ${sqlLiteral(r.subscription_end_date)}::timestamptz,`);
    lines.push(`  payment_mode = ${sqlLiteral(r.payment_mode)}::public.payment_mode`);
    lines.push(`WHERE slug = ${sqlLiteral(r.slug)};`);
    lines.push("");
  }

  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

function readPoolerUrlFromTemp() {
  const p = resolve("supabase/.temp/pooler-url");
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8").trim() || null;
}

async function fetchViaRest() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from("restaurants")
    .select("id, name, slug, subscription_tier, subscription_status, subscription_end_date, payment_mode")
    .in("slug", SLUGS)
    .order("slug");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchViaPooler() {
  const password =
    process.env.SUPABASE_DB_PASSWORD?.trim() || process.env.POSTGRES_PASSWORD?.trim();
  if (!password) throw new Error("Missing SUPABASE_DB_PASSWORD");

  const pooler = readPoolerUrlFromTemp();
  if (!pooler) throw new Error("Missing supabase/.temp/pooler-url");

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
      `select id::text as id, name, slug, subscription_tier::text as subscription_tier,
              subscription_status::text as subscription_status,
              subscription_end_date::text as subscription_end_date,
              payment_mode::text as payment_mode
       from public.restaurants
       where slug = any($1::text[])
       order by slug`,
      [SLUGS]
    );
    return rows;
  } finally {
    await client.end();
  }
}

let rows;
let source = "rest";
try {
  rows = await fetchViaRest();
} catch (restErr) {
  console.warn("REST capture failed, trying Postgres pooler:", restErr.message);
  source = "pooler";
  rows = await fetchViaPooler();
}

const bySlug = new Map(rows.map((r) => [r.slug, r]));
const missing = SLUGS.filter((s) => !bySlug.has(s));
if (missing.length) {
  console.error("Missing restaurants in baseline:", missing.join(", "));
  process.exit(1);
}

const baseline = {
  captured_at: new Date().toISOString(),
  source,
  purpose:
    "Step 1.2 rollback baseline for Goronyo/Gorgor/Galeyr tier migration. Do not change subscription_end_date during migration.",
  restaurants: SLUGS.map((slug) => {
    const r = bySlug.get(slug);
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      subscription_tier: r.subscription_tier,
      subscription_status: r.subscription_status,
      subscription_end_date: r.subscription_end_date,
      payment_mode: r.payment_mode,
    };
  }),
};

writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
writeFileSync(ROLLBACK_PATH, buildRollbackSql(baseline), "utf8");

console.log("Captured baseline for", baseline.restaurants.length, "restaurants via", source);
console.log("  JSON:", BASELINE_PATH);
console.log("  SQL:", ROLLBACK_PATH);
console.log("");
for (const r of baseline.restaurants) {
  console.log(
    `  ${r.slug}: tier=${r.subscription_tier} status=${r.subscription_status} end=${r.subscription_end_date} payment=${r.payment_mode}`
  );
}
