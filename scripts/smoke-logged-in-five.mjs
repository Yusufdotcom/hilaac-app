/**
 * Logged-in live smoke for the 5 checks.
 * Uses db CLI for IDs (reliable) + retries for Supabase Auth REST.
 *
 *   node scripts/smoke-logged-in-five.mjs
 *   node scripts/smoke-logged-in-five.mjs --totp=123456
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

config({ path: ".env.local", quiet: true });

const BASE = (
  process.env.NEXT_PUBLIC_APP_URL || "https://www.hilaacapp.so"
).replace(/\/$/, "").replace("://hilaacapp.so", "://www.hilaacapp.so");
const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const ANON = String(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
).trim();
const SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const OWNER_EMAIL = "yusufyare1444@hotmail.com";
const GALEYR = "baba-s-grill-and-cafe";
const GORGOR = "boba-hergeisa";

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const totp = arg("totp")?.trim();

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
  const r = spawnSync("node", ["scripts/supabase-db.mjs", "db", "query", "--linked", sql], {
    encoding: "utf8",
    shell: false,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "db query failed");
  const text = r.stdout || "";
  const start = text.indexOf("{");
  if (start < 0) throw new Error("no JSON in db output");
  return JSON.parse(text.slice(start));
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function withRetry(label, fn, attempts = 4) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      note(`${label} attempt ${i}/${attempts} failed: ${err instanceof Error ? err.message : err}`);
      await sleep(1500 * i);
    }
  }
  throw last;
}

if (!SUPABASE_URL || !ANON || !SERVICE) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cookieHeaderFromSession(session) {
  // Prefer SSR cookie bag when available
  if (globalThis.__smokeCookieBag?.length) {
    return globalThis.__smokeCookieBag.map((c) => `${c.name}=${c.value}`).join("; ");
  }
  const projectRef = new globalThis.URL(SUPABASE_URL).hostname.split(".")[0];
  const name = `sb-${projectRef}-auth-token`;
  const value = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type ?? "bearer",
    user: session.user,
  });
  return `${name}=${value}`;
}

async function signInWithMagicLink(email) {
  // Single attempt when racing a TOTP window — retries burn the code.
  const attempts = totp ? 1 : 4;
  return withRetry("magiclink", async () => {
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    const bag = [];
    const userClient = createServerClient(SUPABASE_URL, ANON, {
      cookies: {
        getAll: () => bag.map(({ name, value }) => ({ name, value })),
        setAll: (cookies) => {
          for (const c of cookies) {
            const i = bag.findIndex((x) => x.name === c.name);
            if (i >= 0) bag[i] = c;
            else bag.push(c);
          }
        },
      },
    });
    const verified = await userClient.auth.verifyOtp({
      type: "email",
      token_hash: data.properties.hashed_token,
    });
    if (verified.error) throw verified.error;
    globalThis.__smokeCookieBag = bag;
    return { client: userClient, session: verified.data.session };
  }, attempts);
}

async function elevateAal2(client, code) {
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  const totpFactor = factors.data.totp?.[0] || factors.data.all?.find((f) => f.factor_type === "totp");
  if (!totpFactor) throw new Error("No TOTP factor");
  const challenge = await client.auth.mfa.challenge({ factorId: totpFactor.id });
  if (challenge.error) throw challenge.error;
  const verified = await client.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challenge.data.id,
    code,
  });
  if (verified.error) throw verified.error;
  return verified.data;
}

console.log(`\n=== Logged-in five @ ${BASE} ===\n`);

const galeyr = dbQuery(`
  select r.id, r.name,
    (select m.id from menu_items m where m.restaurant_id=r.id and m.is_available=true order by m.name limit 1) as item_id,
    (select m.name from menu_items m where m.restaurant_id=r.id and m.is_available=true order by m.name limit 1) as item_name,
    (select t.id from tables t where t.restaurant_id=r.id and t.is_active=true order by t.table_number limit 1) as table_id
  from restaurants r where r.slug='${GALEYR}';
`).rows?.[0];

if (!galeyr?.id || !galeyr.item_id) {
  fail("prep Galeyr ids", JSON.stringify(galeyr));
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(1);
}
pass("prep Galeyr ids", `${galeyr.name} / ${galeyr.item_name}`);

// ---------- Owner session FIRST (TOTP expires in ~30s — do before slow POS) ----------
let ownerSession = null;
let ownerClient = null;
try {
  const signed = await signInWithMagicLink(OWNER_EMAIL);
  ownerClient = signed.client;
  ownerSession = signed.session;
  const aal = await ownerClient.auth.mfa.getAuthenticatorAssuranceLevel();
  note(`Owner AAL: ${aal.data?.currentLevel} → ${aal.data?.nextLevel}`);
  if (totp) {
    await elevateAal2(ownerClient, totp);
    ownerSession = (await ownerClient.auth.getSession()).data.session;
    const aal2 = await ownerClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal2.data?.currentLevel === "aal2") pass("Owner AAL2");
    else fail("Owner AAL2", JSON.stringify(aal2.data));
  } else {
    note("No --totp — AAL2 checks will fail until you pass a fresh code");
  }
} catch (err) {
  fail("Owner session", err instanceof Error ? err.message : String(err));
}

// ---------- 1) POS via temporary cashier ----------
{
  const email = `smoke.cashier.${Date.now()}@hilaacapp.so`;
  const password = `Smk!${randomBytes(10).toString("base64url")}`;
  let uid = null;
  try {
    const created = await withRetry("create cashier", async () => {
      const res = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Smoke Cashier" },
      });
      if (res.error) throw res.error;
      return res.data.user;
    });
    uid = created.id;
    dbQuery(`
      insert into profiles (id, restaurant_id, role, full_name, is_active)
      values ('${uid}', '${galeyr.id}', 'cashier', 'Smoke Cashier', true)
      on conflict (id) do update set restaurant_id=excluded.restaurant_id, role=excluded.role, full_name=excluded.full_name, is_active=true;
    `);

    const bag = [];
    const cashierClient = createServerClient(SUPABASE_URL, ANON, {
      cookies: {
        getAll: () => bag.map(({ name, value }) => ({ name, value })),
        setAll: (cookies) => {
          for (const c of cookies) {
            const i = bag.findIndex((x) => x.name === c.name);
            if (i >= 0) bag[i] = c;
            else bag.push(c);
          }
        },
      },
    });
    const signed = await withRetry("cashier login", async () => {
      const res = await cashierClient.auth.signInWithPassword({ email, password });
      if (res.error || !res.data.session) throw res.error || new Error("no session");
      return res.data.session;
    });
    globalThis.__smokeCookieBag = bag;

    const res = await fetch(`${BASE}/api/staff/orders/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeaderFromSession(signed),
      },
      body: JSON.stringify({
        restaurantId: galeyr.id,
        orderType: galeyr.table_id ? "dine-in" : "takeaway",
        tableId: galeyr.table_id,
        notes: "SMOKE_POS_LOGGED_IN",
        items: [{ menuItemId: galeyr.item_id, quantity: 1, addOnIds: [] }],
      }),
    });
    globalThis.__smokeCookieBag = null;
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.orderId && json.skippedAccept) {
      const row = dbQuery(`
        select order_number, status, accepted_at is not null as accepted, created_by::text as created_by
        from orders where id='${json.orderId}'
      `).rows?.[0];
      if (row?.status === "new" && row.accepted && row.created_by === uid) {
        pass("1 POS New order skips Accept", `#${row.order_number}`);
      } else fail("1 POS DB fields", JSON.stringify(row));
      dbQuery(`update orders set status='cancelled', notes='SMOKE_POS_CANCELLED' where id='${json.orderId}'`);
    } else {
      fail("1 POS create API", `${res.status} ${json.error || json.code || JSON.stringify(json)}`);
    }
  } catch (err) {
    fail("1 POS", err instanceof Error ? err.message : String(err));
  } finally {
    if (uid) {
      try {
        dbQuery(`delete from profiles where id='${uid}'`);
        await admin.auth.admin.deleteUser(uid);
      } catch (e) {
        note(`cashier cleanup: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}

async function ownerFetch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeaderFromSession(ownerSession),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

if (ownerSession) {
  // 2 Chatbot Galeyr
  {
    const { res, json } = await ownerFetch("/api/admin/chatbot", {
      slug: GALEYR,
      messages: [{ role: "user", content: "How is my business doing today?" }],
    });
    if (res.ok && json.reply) {
      pass("2 Chatbot Galeyr", `tools=${(json.toolsUsed || []).map((t) => t.name).join(",") || "none"}`);
      console.log("     ", String(json.reply).slice(0, 160).replace(/\s+/g, " "));
    } else if (json.code === "aal2_required") fail("2 Chatbot Galeyr", "need --totp=XXXXXX");
    else fail("2 Chatbot Galeyr", `${res.status} ${json.error || json.code || ""}`);
  }

  // 3 Gorgor exclusive
  {
    const { res, json } = await ownerFetch("/api/admin/chatbot", {
      slug: GORGOR,
      messages: [{ role: "user", content: "How is my business doing today?" }],
    });
    if (res.status === 403 && (json.gated || json.code === "tier_gated" || /galeyr/i.test(String(json.error)))) {
      pass("3 Gorgor chatbot gated", json.error || json.code);
    } else if (json.code === "aal2_required") fail("3 Gorgor gate", "need --totp before tier check");
    else if (res.ok) fail("3 Gorgor gate", "answered on Gorgor");
    else fail("3 Gorgor gate", `${res.status} ${json.error || json.code || ""}`);
  }

  // 4 Reports
  {
    const { res, json } = await ownerFetch("/api/admin/reports/library", {
      slug: GALEYR,
      reportId: "daily_sales",
    });
    if (res.ok && json.data?.tables?.length) pass("4a Library daily_sales", `${json.data.tables.length} tables`);
    else if (json.code === "aal2_required") fail("4a Library", "need --totp");
    else fail("4a Library", `${res.status} ${json.error || ""}`);

    const loc = await ownerFetch("/api/admin/reports/locations", {
      slug: GALEYR,
      granularity: "monthly",
    });
    if (loc.res.ok && Array.isArray(loc.json.rows)) pass("4b Locations", `${loc.json.rows.length} rows`);
    else if (loc.json.code === "aal2_required") fail("4b Locations", "need --totp");
    else fail("4b Locations", `${loc.res.status} ${loc.json.error || loc.json.code || ""}`);
  }
}

// 5 Currency (PATCH)
if (ownerSession) {
  const before = dbQuery(`select id, currency, currency_rate from restaurants where slug='${GALEYR}'`).rows[0];
  const flipTo = before.currency === "SOS" ? "USD" : "SOS";
  const rate = flipTo === "SOS" ? Number(before.currency_rate) || 571 : 1;
  const res = await fetch(`${BASE}/api/admin/restaurant/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeaderFromSession(ownerSession),
    },
    body: JSON.stringify({ restaurant_id: before.id, currency: flipTo, currency_rate: rate }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.success) {
    await fetch(`${BASE}/api/admin/restaurant/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeaderFromSession(ownerSession),
      },
      body: JSON.stringify({
        restaurant_id: before.id,
        currency: before.currency || "USD",
        currency_rate: before.currency_rate ?? 1,
      }),
    });
    pass("5 Currency toggle", `${before.currency || "USD"} ↔ ${flipTo} (reverted)`);
  } else if (json.code === "aal2_required") fail("5 Currency", "need --totp=XXXXXX");
  else fail("5 Currency", `${res.status} ${json.error || json.code || ""}`);
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (notes.length) {
  console.log("\nNotes:");
  for (const n of notes) console.log(`- ${n}`);
}
if (!totp) {
  console.log(`\nMFA: owner has TOTP enrolled. Paste a fresh code:\n  node scripts/smoke-logged-in-five.mjs --totp=XXXXXX\n`);
}
process.exit(failed ? 1 : 0);
