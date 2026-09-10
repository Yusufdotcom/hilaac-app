/**
 * Fast AAL2-only smoke — use immediately after pasting a fresh TOTP.
 * Skips POS so the code is consumed within ~5s.
 *
 *   node scripts/smoke-aal2-fast.mjs --totp=XXXXXX
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { spawnSync } from "node:child_process";

config({ path: ".env.local", quiet: true });

const BASE = (
  process.env.NEXT_PUBLIC_APP_URL || "https://www.hilaacapp.so"
)
  .replace(/\/$/, "")
  .replace("://hilaacapp.so", "://www.hilaacapp.so");
const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const ANON = String(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
).trim();
const SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const OWNER_EMAIL = "yusufyare1444@hotmail.com";
const GALEYR = "baba-s-grill-and-cafe";
const GORGOR = "boba-hergeisa";

const totp = process.argv.find((a) => a.startsWith("--totp="))?.slice(7)?.trim();
if (!totp) {
  console.error("Usage: node scripts/smoke-aal2-fast.mjs --totp=XXXXXX");
  process.exit(1);
}
if (!SUPABASE_URL || !ANON || !SERVICE) {
  console.error("Missing Supabase env");
  process.exit(1);
}

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

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cookieHeaderFromSession(session) {
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

console.log(`\n=== AAL2 fast smoke @ ${BASE} ===\n`);
const t0 = Date.now();

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

const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: OWNER_EMAIL,
});
if (linkErr) {
  fail("magiclink", linkErr.message);
  process.exit(1);
}
const verified = await userClient.auth.verifyOtp({
  type: "email",
  token_hash: link.properties.hashed_token,
});
if (verified.error) {
  fail("verifyOtp", verified.error.message);
  process.exit(1);
}
globalThis.__smokeCookieBag = bag;
let session = verified.data.session;

const factors = await userClient.auth.mfa.listFactors();
if (factors.error) {
  fail("listFactors", factors.error.message);
  process.exit(1);
}
const totpFactor =
  factors.data.totp?.[0] || factors.data.all?.find((f) => f.factor_type === "totp");
if (!totpFactor) {
  fail("totp factor", "none enrolled");
  process.exit(1);
}
console.log(`MFA challenge at +${Date.now() - t0}ms (factor ${totpFactor.id.slice(0, 8)}…)`);
const challenge = await userClient.auth.mfa.challenge({ factorId: totpFactor.id });
if (challenge.error) {
  fail("challenge", challenge.error.message);
  process.exit(1);
}
const mfa = await userClient.auth.mfa.verify({
  factorId: totpFactor.id,
  challengeId: challenge.data.id,
  code: totp,
});
if (mfa.error) {
  fail("Owner AAL2", mfa.error.message);
  console.log("\nCode rejected. Send a fresh one immediately after this message.\n");
  process.exit(1);
}
session = (await userClient.auth.getSession()).data.session;
const aal = await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
if (aal.data?.currentLevel === "aal2") pass("Owner AAL2", `+${Date.now() - t0}ms`);
else fail("Owner AAL2", JSON.stringify(aal.data));

async function ownerFetch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeaderFromSession(session),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

{
  const { res, json } = await ownerFetch("/api/admin/chatbot", {
    slug: GALEYR,
    messages: [{ role: "user", content: "How is my business doing today?" }],
  });
  if (res.ok && json.reply) {
    pass("Chatbot Galeyr", `tools=${(json.toolsUsed || []).map((t) => t.name).join(",") || "none"}`);
    console.log("     ", String(json.reply).slice(0, 180).replace(/\s+/g, " "));
  } else fail("Chatbot Galeyr", `${res.status} ${json.error || json.code || ""}`);
}

{
  const { res, json } = await ownerFetch("/api/admin/chatbot", {
    slug: GORGOR,
    messages: [{ role: "user", content: "How is my business doing today?" }],
  });
  if (res.status === 403 && (json.gated || json.code === "tier_gated" || /galeyr/i.test(String(json.error)))) {
    pass("Gorgor chatbot gated", json.error || json.code);
  } else if (res.ok) fail("Gorgor gate", "answered on Gorgor");
  else fail("Gorgor gate", `${res.status} ${json.error || json.code || ""}`);
}

{
  const { res, json } = await ownerFetch("/api/admin/reports/library", {
    slug: GALEYR,
    reportId: "daily_sales",
  });
  if (res.ok && json.data?.tables?.length) pass("Library daily_sales", `${json.data.tables.length} tables`);
  else fail("Library", `${res.status} ${json.error || ""}`);

  const loc = await ownerFetch("/api/admin/reports/locations", {
    slug: GALEYR,
    granularity: "monthly",
  });
  if (loc.res.ok && Array.isArray(loc.json.rows)) pass("Locations", `${loc.json.rows.length} rows`);
  else fail("Locations", `${loc.res.status} ${loc.json.error || loc.json.code || ""}`);
}

{
  const before = dbQuery(`select id, currency, currency_rate from restaurants where slug='${GALEYR}'`).rows[0];
  const flipTo = before.currency === "SOS" ? "USD" : "SOS";
  const rate = flipTo === "SOS" ? Number(before.currency_rate) || 571 : 1;
  const res = await fetch(`${BASE}/api/admin/restaurant/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeaderFromSession(session),
    },
    body: JSON.stringify({ restaurant_id: before.id, currency: flipTo, currency_rate: rate }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.success) {
    await fetch(`${BASE}/api/admin/restaurant/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeaderFromSession(session),
      },
      body: JSON.stringify({
        restaurant_id: before.id,
        currency: before.currency || "USD",
        currency_rate: before.currency_rate ?? 1,
      }),
    });
    pass("Currency toggle", `${before.currency || "USD"} ↔ ${flipTo} (reverted)`);
  } else fail("Currency", `${res.status} ${json.error || json.code || ""}`);
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
