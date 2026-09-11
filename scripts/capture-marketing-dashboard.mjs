/**
 * Capture marketing dashboard — prefers localhost, falls back to production.
 * Saves full viewport even if redirected (for debugging).
 */
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });

const BASE = process.env.PROBE_BASE_URL || "http://localhost:3000";
const SLUG = process.env.ADMIN_CAPTURE_SLUG || "baba-s-grill-and-cafe";
const EMAIL = process.env.ADMIN_CAPTURE_EMAIL || "yusufyare1444@hotmail.com";
const outDir = path.join(process.cwd(), "public", "marketing");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "hilaac-dashboard.png");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: EMAIL,
});
if (linkErr || !linkData?.properties?.hashed_token) {
  console.error("generateLink failed", linkErr?.message || linkData);
  process.exit(1);
}

const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: sessionData, error: otpErr } = await anon.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "email",
});
if (otpErr || !sessionData.session) {
  console.error("verifyOtp failed", otpErr?.message);
  process.exit(1);
}

const session = sessionData.session;
const projectRef = new URL(url).hostname.split(".")[0];
const isLocal = BASE.includes("localhost");
const cookieDomain = isLocal ? "localhost" : ".hilaacapp.so";

const browser = await chromium.launch({ channel: "msedge", headless: true }).catch(() =>
  chromium.launch({ channel: "chrome", headless: true })
);
const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  colorScheme: "light",
});

await context.addInitScript(() => {
  try {
    localStorage.setItem("hilaac-admin-theme", "light");
  } catch {
    /* ignore */
  }
});

await context.addCookies([
  {
    name: `sb-${projectRef}-auth-token`,
    value: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    }),
    domain: cookieDomain,
    path: "/",
    httpOnly: false,
    secure: !isLocal,
    sameSite: "Lax",
  },
]);

const page = await context.newPage();
const target = `${BASE}/admin/${SLUG}/dashboard`;
console.log("Capturing", target);

await page.goto(target, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(4000);
console.log("Landed on", page.url());

await page.evaluate(() => {
  localStorage.setItem("hilaac-admin-theme", "light");
  const shell = document.querySelector(".admin-shell");
  if (shell) shell.setAttribute("data-admin-theme", "light");
  document.documentElement.classList.remove("dark");
});
await page.waitForTimeout(1000);

await page.screenshot({ path: outFile, fullPage: false });
await browser.close();

const stats = fs.statSync(outFile);
console.log("Wrote", outFile, `(${Math.round(stats.size / 1024)} KB)`);
if (!page.url().includes("/dashboard")) {
  console.warn("WARNING: URL is not dashboard — may be MFA/login gate. Image still written.");
  process.exitCode = 2;
}
