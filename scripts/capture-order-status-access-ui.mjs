/**
 * Captures dark-mode order status error (access recovery) vs healthy status.
 * Requires Next on TRACK_VERIFY_BASE_URL (default http://localhost:3000).
 */
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { mintOrderAccessToken } from "../lib/payments/charge-token.ts";

config({ path: ".env.local", quiet: true });

function env(k) {
  let v = process.env[k] ?? "";
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
const service = env("SUPABASE_SERVICE_ROLE_KEY");
const base = (env("TRACK_VERIFY_BASE_URL") || "http://localhost:3000").replace(/\/$/, "");
const outDir = join(process.cwd(), "tmp", "order-track-evidence");
mkdirSync(outDir, { recursive: true });

if (!url || !service || !env("CHARGE_TOKEN_SECRET")) {
  console.error("Missing env");
  process.exit(1);
}

async function waitForServer(timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/restaurants/baba-s-grill-and-cafe/branding`, {
        cache: "no-store",
      });
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Server not ready at ${base}`);
}

console.log("Waiting for", base);
await waitForServer();
console.log("Server ready");

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: restaurant } = await admin
  .from("restaurants")
  .select("id, slug, name")
  .eq("slug", "baba-s-grill-and-cafe")
  .maybeSingle();

const rest =
  restaurant ??
  (await admin.from("restaurants").select("id, slug, name").limit(1).maybeSingle()).data;

if (!rest) {
  console.error("No restaurant");
  process.exit(1);
}

const phone = "0612345678";
const { data: order, error } = await admin
  .from("orders")
  .insert({
    restaurant_id: rest.id,
    order_type: "dine-in",
    status: "preparing",
    payment_status: "paid",
    total: 18,
    customer_phone: phone,
    notes: "track-ui-evidence",
  })
  .select("id")
  .single();

if (error || !order) {
  console.error("Seed failed", error?.message);
  process.exit(1);
}

const orderId = order.id;
const accessToken = mintOrderAccessToken(orderId, rest.id);
const statusUrl = `${base}/order/${rest.slug}/status?orderId=${orderId}`;
console.log("Seeded", orderId, statusUrl);

const candidates = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

let browser = null;
for (const executablePath of candidates) {
  if (!existsSync(executablePath)) continue;
  try {
    console.log("Launching", executablePath);
    browser = await chromium.launch({ headless: true, executablePath });
    break;
  } catch (e) {
    console.warn("Launch failed", executablePath, e.message);
  }
}
if (!browser) {
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  } catch (e1) {
    try {
      browser = await chromium.launch({ channel: "chrome", headless: true });
    } catch (e2) {
      console.error("Could not launch browser", e1.message, e2.message);
      await admin.from("orders").delete().eq("id", orderId);
      process.exit(1);
    }
  }
}

const contrastReport = [];
const networkLog = [];

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem("hilaac-order-theme", "dark");
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("hilaac-order-access:")) localStorage.removeItem(key);
    }
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("hilaac-order-access:") || key.startsWith("hilaac-order-charge:")) {
        sessionStorage.removeItem(key);
      }
    }
  });

  page.on("response", async (res) => {
    const u = res.url();
    if (!u.includes(`/api/orders/${orderId}/`)) return;
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    networkLog.push({
      status: res.status(),
      method: res.request().method(),
      path: u.replace(base, ""),
      bodySummary: body?.accessToken
        ? { accessToken: "<present>" }
        : body?.order
          ? { orderId: body.order.id, status: body.order.status }
          : body,
    });
  });

  console.log("Opening error state (no token)...");
  await page.goto(statusUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=Order status unavailable", { timeout: 45000 });
  await page.waitForSelector("#recover-phone", { timeout: 15000 });
  await page.waitForTimeout(600);

  const errorShot = join(outDir, "dark-error-access-recovery.png");
  await page.screenshot({ path: errorShot, fullPage: true });
  console.log("Wrote", errorShot);

  const errorStyles = await page.evaluate(() => {
    const title = document.querySelector("h1");
    const muted = Array.from(document.querySelectorAll("p")).find((p) =>
      (p.className || "").includes("muted")
    );
    const shell = document.querySelector("[data-order-theme]");
    const pick = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const rgb = cs.color.match(/\d+/g)?.map(Number) ?? [];
      const luminance =
        rgb.length >= 3
          ? (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
          : null;
      return {
        text: (el.textContent || "").trim().slice(0, 140),
        color: cs.color,
        luminance,
        fontSize: cs.fontSize,
        paddingLeft: cs.paddingLeft,
        className: el.className,
      };
    };
    const bg = getComputedStyle(shell || document.body).backgroundColor;
    const bgRgb = bg.match(/\d+/g)?.map(Number) ?? [];
    const bgLum =
      bgRgb.length >= 3
        ? (0.2126 * bgRgb[0] + 0.7152 * bgRgb[1] + 0.0722 * bgRgb[2]) / 255
        : null;
    return {
      background: bg,
      backgroundLuminance: bgLum,
      title: pick(title),
      body: pick(muted),
      theme: shell?.getAttribute("data-order-theme"),
    };
  });
  contrastReport.push({ state: "error", ...errorStyles });

  console.log("Recovering via phone...");
  await page.fill("#recover-phone", phone);
  const [recoverRes] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/recover-access") && r.request().method() === "POST",
      { timeout: 45000 }
    ),
    page.getByRole("button", { name: /view order status/i }).click(),
  ]);
  console.log("recover-access status", recoverRes.status());

  await page.waitForSelector("text=Dalabkaagu wuu socdaa", { timeout: 45000 });
  await page.waitForTimeout(700);

  const okShot = join(outDir, "dark-normal-status.png");
  await page.screenshot({ path: okShot, fullPage: true });
  console.log("Wrote", okShot);

  const okStyles = await page.evaluate(() => {
    const title = document.querySelector("h1");
    const muted = Array.from(document.querySelectorAll("p")).find((p) =>
      (p.className || "").includes("muted")
    );
    const shell = document.querySelector("[data-order-theme]");
    const pick = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const rgb = cs.color.match(/\d+/g)?.map(Number) ?? [];
      const luminance =
        rgb.length >= 3
          ? (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
          : null;
      return {
        text: (el.textContent || "").trim().slice(0, 140),
        color: cs.color,
        luminance,
        fontSize: cs.fontSize,
        paddingLeft: cs.paddingLeft,
        className: el.className,
      };
    };
    return {
      background: getComputedStyle(shell || document.body).backgroundColor,
      title: pick(title),
      body: pick(muted),
      theme: shell?.getAttribute("data-order-theme"),
      rootPadding: getComputedStyle(
        document.querySelector(".order-flow")?.firstElementChild || document.body
      ).paddingLeft,
    };
  });
  contrastReport.push({ state: "normal", ...okStyles });

  // Combine into one side-by-side PNG using Playwright clip screenshots on a blank page
  // with data URLs loaded from the two files via page.evaluate + canvas.
  const sidePage = await context.newPage();
  const errorB64 = (await import("fs")).readFileSync(errorShot).toString("base64");
  const okB64 = (await import("fs")).readFileSync(okShot).toString("base64");
  await sidePage.setContent(`<!doctype html>
<html><body style="margin:0;background:#0b0b0b;display:flex;gap:12px;padding:12px;font-family:Segoe UI,sans-serif;color:#fff">
  <figure style="margin:0;flex:1">
    <figcaption style="font-size:12px;margin-bottom:6px">Error / phone recovery</figcaption>
    <img id="a" src="data:image/png;base64,${errorB64}" style="width:100%;border:1px solid #333;border-radius:8px"/>
  </figure>
  <figure style="margin:0;flex:1">
    <figcaption style="font-size:12px;margin-bottom:6px">Normal status</figcaption>
    <img id="b" src="data:image/png;base64,${okB64}" style="width:100%;border:1px solid #333;border-radius:8px"/>
  </figure>
</body></html>`);
  await sidePage.waitForSelector("#a");
  await sidePage.waitForTimeout(300);
  const sideShot = join(outDir, "dark-side-by-side.png");
  await sidePage.screenshot({ path: sideShot, fullPage: true });
  console.log("Wrote", sideShot);

  writeFileSync(join(outDir, "contrast-report.json"), JSON.stringify(contrastReport, null, 2));
  writeFileSync(join(outDir, "network-log.json"), JSON.stringify(networkLog, null, 2));
  writeFileSync(
    join(outDir, "meta.json"),
    JSON.stringify(
      {
        orderId,
        statusUrl,
        phone,
        accessTokenExp: accessToken.split(".")[2],
        screenshots: { error: errorShot, normal: okShot, sideBySide: sideShot },
      },
      null,
      2
    )
  );

  console.log("\nContrast report:");
  console.log(JSON.stringify(contrastReport, null, 2));
  console.log("\nNetwork log:");
  console.log(JSON.stringify(networkLog, null, 2));
} finally {
  await browser.close();
  await admin.from("orders").delete().eq("id", orderId);
  console.log("Cleanup done");
}
