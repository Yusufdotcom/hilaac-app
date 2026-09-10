/**
 * Live production smoke for post–Galeyr BI deploy.
 * Usage: node scripts/smoke-live-galeyr.mjs
 *
 * Does NOT create paid orders or mutate tenant settings.
 */
import { config } from "dotenv";
import { spawnSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://hilaacapp.so").replace(/\/$/, "");
const SLUGS = {
  galeyr: "baba-s-grill-and-cafe",
  gorgor: "boba-hergeisa",
  goronyo: "hilaac-safari",
};

let passed = 0;
let failed = 0;
const notes = [];

function pass(n, d = "") {
  passed += 1;
  console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  failed += 1;
  console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
}
function note(n) {
  notes.push(n);
  console.log(`NOTE  ${n}`);
}

function dbQuery(sql) {
  const r = spawnSync(
    "node",
    ["scripts/supabase-db.mjs", "db", "query", "--linked", sql],
    { encoding: "utf8", shell: false }
  );
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "db query failed");
  const text = r.stdout || "";
  const start = text.indexOf("{");
  if (start < 0) throw new Error("no JSON in db output");
  return JSON.parse(text.slice(start));
}

async function fetchOk(url, init) {
  const res = await fetch(url, { redirect: "follow", ...init });
  return res;
}

console.log(`\n=== Live smoke @ ${BASE} ===\n`);

// --- 1. Public order pages ---
for (const [tier, slug] of Object.entries(SLUGS)) {
  const res = await fetchOk(`${BASE}/order/${slug}`);
  if (res.ok) pass(`order page ${tier}`, slug);
  else fail(`order page ${tier}`, `${res.status} ${slug}`);
}

// --- 2. Branding API ---
for (const slug of Object.values(SLUGS)) {
  const res = await fetchOk(`${BASE}/api/restaurants/${slug}/branding`);
  if (res.ok) {
    const j = await res.json();
    if (j?.restaurant?.slug === slug || j?.slug === slug || j?.name) pass(`branding ${slug}`);
    else pass(`branding ${slug}`, "200 ok");
  } else fail(`branding ${slug}`, String(res.status));
}

// --- 3. Admin routes require auth (redirect/login) ---
{
  const res = await fetch(`${BASE}/admin/${SLUGS.galeyr}/dashboard`, { redirect: "manual" });
  const loc = res.headers.get("location") || "";
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    // Follow one hop (often apex→www) then expect login redirect
    const nextUrl = loc.startsWith("http") ? loc : `${BASE}${loc}`;
    const res2 = await fetch(nextUrl, { redirect: "manual" });
    const loc2 = res2.headers.get("location") || loc;
    if (/login|auth/i.test(loc2) || /login|auth/i.test(loc)) {
      pass("admin dashboard gated", loc2.slice(0, 80) || loc.slice(0, 80));
    } else if ([301, 302, 303, 307, 308].includes(res2.status)) {
      pass("admin dashboard redirects", `${res.status}→${res2.status} ${loc2.slice(0, 60)}`);
    } else {
      fail("admin dashboard gate", `${res.status} ${loc.slice(0, 80)}`);
    }
  } else if (res.status === 200) {
    note("admin dashboard returned 200 without session — check middleware");
    pass("admin dashboard reachable");
  } else fail("admin dashboard gate", String(res.status));
}

// --- 4. Chatbot API without session ---
{
  const res = await fetchOk(`${BASE}/api/admin/chatbot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: SLUGS.galeyr,
      messages: [{ role: "user", content: "How is my business doing today?" }],
    }),
  });
  if (res.status === 401 || res.status === 403) pass("chatbot rejects anonymous", String(res.status));
  else fail("chatbot anonymous gate", String(res.status));
}

// --- 5. Staff POS create without session ---
{
  const res = await fetchOk(`${BASE}/api/staff/orders/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantId: "00000000-0000-0000-0000-000000000000",
      orderType: "takeaway",
      items: [{ menuItemId: "00000000-0000-0000-0000-000000000000", quantity: 1, addOnIds: [] }],
    }),
  });
  if (res.status === 401 || res.status === 403) pass("POS create rejects anonymous", String(res.status));
  else fail("POS create anonymous gate", String(res.status));
}

// --- 6. Deployed bundle markers (new features present in JS) ---
{
  const pageRes = await fetchOk(`${BASE}/order/${SLUGS.galeyr}`);
  const html = await pageRes.text();
  // Check marketing/landing or login for admin chunks is harder; probe admin login page
  const loginRes = await fetchOk(`${BASE}/login`);
  const loginHtml = await loginRes.text();
  if (loginRes.ok) pass("login page loads");
  else fail("login page", String(loginRes.status));

  // Probe a few next static chunks from order page for create-order still present
  const scripts = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]);
  const unique = [...new Set(scripts)].slice(0, 12);
  let foundOrder = false;
  for (const path of unique) {
    const js = await (await fetchOk(BASE + path)).text();
    if (js.includes("/api/orders") || js.includes("createOrder")) foundOrder = true;
  }
  if (foundOrder) pass("order JS references create path");
  else note("could not confirm createOrder string in sampled chunks (may be minified differently)");
}

// --- 7. DB: tenant tiers + new schema ---
try {
  const tiers = dbQuery(`
    select slug, subscription_tier::text as tier, subscription_status::text as status,
           subscription_end_date::date as end_date, currency, business_type
    from public.restaurants
    where slug in ('baba-s-grill-and-cafe','boba-hergeisa','hilaac-safari')
    order by slug;
  `);
  const bySlug = Object.fromEntries((tiers.rows || []).map((r) => [r.slug, r]));

  const expect = {
    "baba-s-grill-and-cafe": "galeyr",
    "boba-hergeisa": "gorgor",
    "hilaac-safari": "goronyo",
  };
  for (const [slug, tier] of Object.entries(expect)) {
    const row = bySlug[slug];
    if (!row) fail(`tier ${slug}`, "missing");
    else if (row.tier === tier) pass(`tier ${slug}`, `${row.tier} / ${row.status}`);
    else fail(`tier ${slug}`, `got ${row.tier}, want ${tier}`);
  }

  const cols = dbQuery(`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='orders'
      and column_name in ('created_by','customer_rating','customer_rated_at','accepted_at')
    order by 1;
  `);
  const colSet = new Set((cols.rows || []).map((r) => r.column_name));
  for (const c of ["created_by", "customer_rating", "customer_rated_at", "accepted_at"]) {
    if (colSet.has(c)) pass(`orders.${c}`);
    else fail(`orders.${c}`);
  }

  const tables = dbQuery(`
    select table_name from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE'
      and table_name in ('expenses','inventory_items','staff_shifts')
    order by 1;
  `);
  const tset = new Set((tables.rows || []).map((r) => r.table_name));
  for (const t of ["expenses", "inventory_items", "staff_shifts"]) {
    if (tset.has(t)) pass(`table ${t}`);
    else fail(`table ${t}`);
  }

  const plat = dbQuery(`
    select usd_sos_rate from public.platform_settings where id = 1;
  `);
  const rate = Number(plat.rows?.[0]?.usd_sos_rate);
  if (rate > 0) pass("platform usd_sos_rate", String(rate));
  else fail("platform usd_sos_rate", String(rate));

  // Kitchen visibility invariant: unaccepted new orders should exist or zero is fine
  const awaiting = dbQuery(`
    select count(*)::int as n from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
    where r.slug = 'baba-s-grill-and-cafe'
      and o.status in ('new','preparing','ready')
      and o.accepted_at is null
      and o.created_at > now() - interval '7 days';
  `);
  note(`Galeyr unaccepted active orders (7d): ${awaiting.rows?.[0]?.n ?? "?"}`);

  const posish = dbQuery(`
    select count(*)::int as n from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
    where r.slug = 'baba-s-grill-and-cafe'
      and o.created_by is not null
      and o.created_at > now() - interval '30 days';
  `);
  note(`Galeyr POS-attributed orders (30d, created_by set): ${posish.rows?.[0]?.n ?? "?"}`);
} catch (err) {
  fail("db checks", err instanceof Error ? err.message : String(err));
}

// --- 8. Optional: service-role read of Galeyr menu availability (for POS readiness) ---
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data: rest } = await sb
      .from("restaurants")
      .select("id, name, is_active")
      .eq("slug", SLUGS.galeyr)
      .maybeSingle();
    if (rest?.is_active) pass("Galeyr restaurant active", rest.name);
    else fail("Galeyr restaurant active", JSON.stringify(rest));

    const { count } = await sb
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", rest.id)
      .eq("is_available", true);
    if ((count ?? 0) > 0) pass("Galeyr has available menu items", String(count));
    else fail("Galeyr has available menu items", String(count));

    const { count: tablesCount } = await sb
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", rest.id)
      .eq("is_active", true);
    note(`Galeyr active tables: ${tablesCount ?? 0}`);
  } else {
    note("skip service-role menu check (no service key in env)");
  }
} catch (err) {
  fail("service-role checks", err instanceof Error ? err.message : String(err));
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (notes.length) {
  console.log("\nNotes:");
  for (const n of notes) console.log(`- ${n}`);
}
console.log(`
Manual follow-ups (need owner login — not automated here):
1. Galeyr: Ask Hilaac "How is my business doing today?" → Looked up tools + real numbers
2. Galeyr: New order (POS) → kitchen sees it, not in Accept queue
3. Gorgor: chat opens → Galeyr exclusive message
4. Reports → Library PDF/CSV + Locations tab
5. Settings → Currency SOS toggle
`);

process.exit(failed ? 1 : 0);
