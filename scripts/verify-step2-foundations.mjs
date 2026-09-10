/**
 * Verify Step 2 database foundations on the linked project.
 * Usage: node scripts/verify-step2-foundations.mjs
 */
import { spawnSync } from "child_process";

function query(sql) {
  const r = spawnSync(
    "node",
    ["scripts/supabase-db.mjs", "db", "query", "--linked", sql],
    { encoding: "utf8", shell: false }
  );
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "query failed");
  }
  const text = r.stdout || "";
  const start = text.indexOf("{");
  if (start < 0) throw new Error("no JSON in query output:\n" + text);
  return JSON.parse(text.slice(start));
}

let passed = 0;
let failed = 0;
function pass(n) {
  passed += 1;
  console.log("PASS ", n);
}
function fail(n, d = "") {
  failed += 1;
  console.log("FAIL ", n, d);
}

const cols = query(`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and (
      (table_name = 'menu_items' and column_name = 'cost_price')
      or (table_name = 'restaurants' and column_name in ('currency','currency_rate','business_type'))
      or (table_name = 'profiles' and column_name = 'hourly_rate')
    )
  order by table_name, column_name;
`);
const colSet = new Set((cols.rows || []).map((r) => `${r.table_name}.${r.column_name}`));
for (const c of [
  "menu_items.cost_price",
  "restaurants.currency",
  "restaurants.currency_rate",
  "restaurants.business_type",
  "profiles.hourly_rate",
]) {
  if (colSet.has(c)) pass(`column ${c}`);
  else fail(`column ${c}`);
}

const tables = query(`
  select table_name from information_schema.tables
  where table_schema = 'public'
    and table_name in ('expenses','inventory_items')
    and table_type = 'BASE TABLE';
`);
const tableSet = new Set((tables.rows || []).map((r) => r.table_name));
if (tableSet.has("expenses")) pass("table expenses");
else fail("table expenses");
if (tableSet.has("inventory_items")) pass("table inventory_items");
else fail("table inventory_items");

const views = query(`
  select table_name from information_schema.views
  where table_schema = 'public' and table_name = 'customer_profiles';
`);
if ((views.rows || []).length === 1) pass("view customer_profiles");
else fail("view customer_profiles");

const tenants = query(`
  select slug, subscription_tier, subscription_end_date::text as end_date,
         currency, currency_rate::text as rate, business_type
  from restaurants
  where slug in ('hilaac-safari','boba-hergeisa','baba-s-grill-and-cafe')
  order by slug;
`);
const bySlug = Object.fromEntries((tenants.rows || []).map((r) => [r.slug, r]));
const expected = {
  "baba-s-grill-and-cafe": "galeyr",
  "boba-hergeisa": "gorgor",
  "hilaac-safari": "goronyo",
};
for (const [slug, tier] of Object.entries(expected)) {
  const row = bySlug[slug];
  if (!row) {
    fail(`${slug} missing`);
    continue;
  }
  if (row.subscription_tier === tier) pass(`${slug} tier ${tier}`);
  else fail(`${slug} tier`, `${row.subscription_tier}`);
  if (row.currency === "USD" && Number(row.rate) === 1 && row.business_type === "restaurant") {
    pass(`${slug} currency/business defaults`);
  } else fail(`${slug} defaults`, JSON.stringify(row));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
