/**
 * Verify canonical app URL helpers for Google OAuth + password-reset redirectTo.
 */
import { getAppUrl, buildAppUrl } from "../lib/app-url.ts";

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

const prevApp = process.env.NEXT_PUBLIC_APP_URL;
const prevNode = process.env.NODE_ENV;
const prevVercel = process.env.VERCEL_URL;

process.env.NEXT_PUBLIC_APP_URL = "https://hilaacapp.so";
process.env.NODE_ENV = "production";
delete process.env.VERCEL_URL;

try {
  const base = getAppUrl();
  if (base === "https://hilaacapp.so") pass("getAppUrl uses NEXT_PUBLIC_APP_URL", base);
  else fail("getAppUrl uses NEXT_PUBLIC_APP_URL", base);

  const googleRedirect = `${getAppUrl()}/auth/callback`;
  if (googleRedirect === "https://hilaacapp.so/auth/callback") {
    pass("Google OAuth redirectTo", googleRedirect);
  } else fail("Google OAuth redirectTo", googleRedirect);

  const resetRedirect = `${getAppUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
  if (resetRedirect === "https://hilaacapp.so/auth/callback?next=%2Freset-password") {
    pass("password-reset redirectTo", resetRedirect);
  } else fail("password-reset redirectTo", resetRedirect);

  const order = buildAppUrl("/order/demo-slug");
  if (order === "https://hilaacapp.so/order/demo-slug") pass("buildAppUrl QR/order link", order);
  else fail("buildAppUrl QR/order link", order);

  // Poison VERCEL_URL — must still use NEXT_PUBLIC_APP_URL
  process.env.VERCEL_URL = "hilaac-app.vercel.app";
  if (getAppUrl() === "https://hilaacapp.so") {
    pass("ignores VERCEL_URL when APP_URL set");
  } else fail("ignores VERCEL_URL when APP_URL set", getAppUrl());

  delete process.env.NEXT_PUBLIC_APP_URL;
  process.env.VERCEL_URL = "hilaac-app.vercel.app";
  let threw = false;
  try {
    getAppUrl();
  } catch (e) {
    threw = /NEXT_PUBLIC_APP_URL/.test(String(e?.message ?? e));
  }
  if (threw) pass("production missing APP_URL throws (no Vercel fallback)");
  else fail("production missing APP_URL throws (no Vercel fallback)");

  process.env.NODE_ENV = "development";
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_URL;
  if (getAppUrl() === "http://localhost:3000") pass("dev fallback localhost");
  else fail("dev fallback localhost", getAppUrl());
} finally {
  if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prevApp;
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
  if (prevVercel === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = prevVercel;
}

console.log(`\nApp URL redirects: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
