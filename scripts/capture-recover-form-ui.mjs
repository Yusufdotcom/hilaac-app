/**
 * Light-mode screenshots of order recovery form: empty + error states.
 */
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

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
const outDir = join(process.cwd(), "tmp", "recover-form-evidence");
mkdirSync(outDir, { recursive: true });

if (!url || !service) {
  console.error("Missing Supabase env");
  process.exit(1);
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${base}/api/restaurants/baba-s-grill-and-cafe/branding`, {
        cache: "no-store",
      });
      if (res.ok || res.status === 404) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Server not ready");
}

await waitForServer();

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: rest } =
  (await admin
    .from("restaurants")
    .select("id, slug")
    .eq("slug", "baba-s-grill-and-cafe")
    .maybeSingle()) ?? {};

const restaurant =
  rest ??
  (await admin.from("restaurants").select("id, slug").limit(1).maybeSingle()).data;

if (!restaurant) {
  console.error("No restaurant");
  process.exit(1);
}

const phone = "0612345678";
const { data: order, error } = await admin
  .from("orders")
  .insert({
    restaurant_id: restaurant.id,
    order_type: "dine-in",
    status: "preparing",
    payment_status: "paid",
    total: 15,
    customer_phone: phone,
    notes: "recover-form-ui",
  })
  .select("id")
  .single();

if (error || !order) {
  console.error("Seed failed", error?.message);
  process.exit(1);
}

const statusUrl = `${base}/order/${restaurant.slug}/status?orderId=${order.id}`;
console.log(statusUrl);

const candidates = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

let browser;
for (const executablePath of candidates) {
  if (!existsSync(executablePath)) continue;
  try {
    browser = await chromium.launch({ headless: true, executablePath });
    break;
  } catch {
    /* try next */
  }
}
if (!browser) browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("hilaac-order-theme", "light");
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("hilaac-order-access:")) localStorage.removeItem(key);
    }
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("hilaac-order-access:") || key.startsWith("hilaac-order-charge:")) {
        sessionStorage.removeItem(key);
      }
    }
  });

  await page.goto(statusUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("#recover-phone", { timeout: 45000 });
  await page.waitForTimeout(500);

  const emptyPath = join(outDir, "light-recover-empty.png");
  await page.screenshot({ path: emptyPath, fullPage: true });
  console.log("Wrote", emptyPath);

  // Measure disabled button color
  const emptyStyles = await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]');
    const label = document.querySelector('label[for="recover-phone"]');
    const retry = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Retry with saved session")
    );
    const title = document.querySelector("h1");
    const pick = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { text: (el.textContent || "").trim().slice(0, 80), color: cs.color, opacity: cs.opacity, bg: cs.backgroundColor };
    };
    return { title: pick(title), label: pick(label), button: pick(btn), retry: pick(retry) };
  });
  console.log("Empty state styles:", JSON.stringify(emptyStyles, null, 2));

  await page.fill("#recover-phone", "0699999999");
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/recover-access") && r.request().method() === "POST"),
    page.getByRole("button", { name: /recover my order/i }).click(),
  ]);
  await page.waitForSelector("text=Phone number does not match", { timeout: 15000 });
  await page.waitForTimeout(400);

  const errorPath = join(outDir, "light-recover-error.png");
  await page.screenshot({ path: errorPath, fullPage: true });
  console.log("Wrote", errorPath);

  const errorStyles = await page.evaluate(() => {
    const err = Array.from(document.querySelectorAll("p")).find((p) =>
      (p.textContent || "").includes("Phone number does not match")
    );
    const btn = document.querySelector('button[type="submit"]');
    const cs = err ? getComputedStyle(err) : null;
    const bcs = btn ? getComputedStyle(btn) : null;
    return {
      error: err
        ? { text: err.textContent.trim(), color: cs.color, opacity: cs.opacity }
        : null,
      buttonEnabled: btn
        ? { color: bcs.color, bg: bcs.backgroundColor, opacity: bcs.opacity }
        : null,
    };
  });
  console.log("Error state styles:", JSON.stringify(errorStyles, null, 2));

  writeFileSync(
    join(outDir, "styles.json"),
    JSON.stringify({ empty: emptyStyles, error: errorStyles }, null, 2)
  );
} finally {
  await browser.close();
  await admin.from("orders").delete().eq("id", order.id);
}
