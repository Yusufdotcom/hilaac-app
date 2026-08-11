/**
 * Guard: middleware must never pull Node.js crypto or next/headers via support-session.
 * Also round-trips Web Crypto HMAC mint/verify.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

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

const mw = readFileSync(resolve("lib/supabase/middleware.ts"), "utf8");
const ss = readFileSync(resolve("lib/platform/support-session.ts"), "utf8");
const sss = readFileSync(resolve("lib/platform/support-session-server.ts"), "utf8");

if (!mw.includes('from "crypto"') && !mw.includes("from 'crypto'")) pass("middleware has no Node crypto import");
else fail("middleware has no Node crypto import");

if (!ss.includes('from "crypto"') && !ss.includes("from 'crypto'") && !ss.includes("node:crypto")) {
  pass("support-session.ts has no Node crypto import");
} else fail("support-session.ts has no Node crypto import");

if (!ss.includes("next/headers")) pass("support-session.ts has no next/headers (Edge-safe)");
else fail("support-session.ts has no next/headers");

if (sss.includes("next/headers") && sss.includes("readSupportSessionForUser")) {
  pass("server helper isolates next/headers");
} else fail("server helper isolates next/headers");

if (mw.includes("await readSupportSessionFromRequest")) pass("middleware awaits async Edge-safe verify");
else fail("middleware awaits async Edge-safe verify");

if (ss.includes("crypto.subtle") && ss.includes("HMAC")) pass("uses Web Crypto subtle HMAC");
else fail("uses Web Crypto subtle HMAC");

// Round-trip (Node has global crypto.subtle)
const { mintPlatformSupportToken, verifyPlatformSupportToken } = await import(
  "../lib/platform/support-session.ts"
);

const userId = "11111111-1111-1111-1111-111111111111";
const restaurantId = "22222222-2222-2222-2222-222222222222";
const slug = "boba-hergeisa";

try {
  const token = await mintPlatformSupportToken(userId, restaurantId, slug);
  const ok = await verifyPlatformSupportToken(token, userId);
  if (ok?.slug === slug && ok.restaurantId === restaurantId) pass("mint/verify round-trip");
  else fail("mint/verify round-trip", JSON.stringify(ok));

  const wrongUser = await verifyPlatformSupportToken(token, "33333333-3333-3333-3333-333333333333");
  if (wrongUser === null) pass("token rejects wrong userId");
  else fail("token rejects wrong userId");
} catch (e) {
  fail("mint/verify round-trip", e instanceof Error ? e.message : String(e));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
