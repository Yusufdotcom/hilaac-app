/**
 * Capture dark-mode screenshots of all major Admin pages.
 * Auth: Supabase service-role magic link for Baba owner.
 */
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });

const BASE = process.env.PROBE_BASE_URL || "http://localhost:3000";
const SLUG = "baba-s-grill-and-cafe";
const EMAIL = process.env.ADMIN_CAPTURE_EMAIL || "yusufyare1444@hotmail.com";
const outDir = path.join(process.cwd(), "tmp", "admin-dark-evidence");
fs.mkdirSync(outDir, { recursive: true });

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

const pages = [
  ["dashboard", `/admin/${SLUG}/dashboard`],
  ["reports", `/admin/${SLUG}/reports`],
  ["menu", `/admin/${SLUG}/menu`],
  ["tables", `/admin/${SLUG}/tables`],
  ["orders", `/admin/${SLUG}/orders`],
  ["staff", `/admin/${SLUG}/staff`],
  ["settings", `/admin/${SLUG}/settings`],
  ["billing", `/admin/${SLUG}/billing`],
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});

await context.addInitScript((themeKey) => {
  try {
    localStorage.setItem(themeKey, "dark");
  } catch {
    /* ignore */
  }
}, "hilaac-admin-theme");

// Supabase SSR cookie shape used by @supabase/ssr
const cookieBase = {
  domain: "localhost",
  path: "/",
  httpOnly: false,
  secure: false,
  sameSite: "Lax",
};
await context.addCookies([
  {
    ...cookieBase,
    name: `sb-${projectRef}-auth-token`,
    value: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    }),
  },
]);

const page = await context.newPage();
const results = [];

for (const [name, route] of pages) {
  const target = `${BASE}${route}`;
  console.log("Capturing", name, target);
  try {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2500);
    // Force dark attribute if provider hasn't hydrated yet
    await page.evaluate(() => {
      localStorage.setItem("hilaac-admin-theme", "dark");
      const shell = document.querySelector(".admin-shell");
      if (shell) shell.setAttribute("data-admin-theme", "dark");
    });
    await page.waitForTimeout(500);

    const theme = await page.evaluate(() => {
      const shell = document.querySelector(".admin-shell");
      if (!shell) return { ok: false, reason: "no-shell", href: location.href };
      const cs = getComputedStyle(shell);
      const card = document.querySelector(
        ".admin-surface, [class*='bg-card'], .rounded-xl.border.bg-card, article.rounded-xl, [class*='Card']"
      );
      const cardBg = card ? getComputedStyle(card).backgroundColor : null;
      return {
        ok: true,
        href: location.href,
        dataTheme: shell.getAttribute("data-admin-theme"),
        adminCard: cs.getPropertyValue("--admin-card").trim(),
        shellColor: cs.color,
        shellBg: cs.backgroundColor,
        cardBg,
      };
    });

    const file = path.join(outDir, `dark-${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    results.push({ name, file, ...theme });
    console.log("  ->", theme.dataTheme, theme.adminCard, theme.cardBg);
  } catch (e) {
    console.error("  FAIL", name, e.message);
    results.push({ name, error: e.message });
  }
}

fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
await browser.close();
console.log("Wrote", outDir);
const failed = results.filter((r) => r.error || r.dataTheme !== "dark");
process.exit(failed.length ? 1 : 0);
