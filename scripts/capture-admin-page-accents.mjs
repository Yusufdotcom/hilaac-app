import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const base = process.env.PROBE_BASE_URL || "http://localhost:3001";
const outDir = path.join(process.cwd(), "tmp", "admin-design-evidence", "pages");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name, url) {
  await page.goto(`${base}${url}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(400);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
}

await shot("00-dashboard-accents", "/dev/admin-accent-probe");
await shot("01-menu", "/dev/menu-probe");
await shot("02-settings-region", "/dev/settings-probe?layout=fixed");

// Section crops from accent probe
await page.goto(`${base}/dev/admin-accent-probe`, { waitUntil: "networkidle" });
for (const section of [
  "dashboard",
  "menu",
  "orders",
  "tables",
  "reports",
  "staff",
  "billing",
  "settings",
  "misc",
]) {
  const el = page.locator(`[data-probe="${section}"]`);
  if (await el.count()) {
    await el.screenshot({ path: path.join(outDir, `section-${section}.png`) });
    console.log("wrote section", section);
  }
}

// localStorage access-token survival smoke (no UI login required)
await page.goto(`${base}/dev/menu-probe`, { waitUntil: "domcontentloaded" });
const storageTest = await page.evaluate(() => {
  const orderId = "00000000-0000-4000-8000-000000000099";
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${orderId}.rest.${exp}.fakesig`;
  localStorage.setItem(`hilaac-order-access:${orderId}`, token);
  sessionStorage.clear();
  const fromSession = sessionStorage.getItem(`hilaac-order-access:${orderId}`);
  const fromLocal = localStorage.getItem(`hilaac-order-access:${orderId}`);
  return { fromSession, fromLocal, survivesSessionClear: !fromSession && !!fromLocal };
});
fs.writeFileSync(
  path.join(outDir, "access-token-localstorage.json"),
  JSON.stringify(storageTest, null, 2)
);
console.log("storageTest", storageTest);

await browser.close();
