import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PROBE_BASE_URL || "http://localhost:3000";
const outDir = path.join(process.cwd(), "tmp", "admin-dark-evidence");
fs.mkdirSync(outDir, { recursive: true });

const pages = [
  "dashboard",
  "reports",
  "menu",
  "tables",
  "orders",
  "staff",
  "settings",
  "billing",
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});
await context.addInitScript(() => {
  localStorage.setItem("hilaac-admin-theme", "dark");
});

const page = await context.newPage();
const results = [];

for (const name of pages) {
  const target = `${BASE}/dev/admin-dark-probe?page=${name}`;
  console.log("Capturing", name);
  await page.goto(target, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector(`[data-probe-page="${name}"]`, { timeout: 60000 });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector(".admin-shell");
    const card =
      document.querySelector(".admin-surface") ||
      document.querySelector("[class*='bg-card']") ||
      document.querySelector(".rounded-xl.border");
    const shellCs = shell ? getComputedStyle(shell) : null;
    const cardCs = card ? getComputedStyle(card) : null;
    return {
      dataTheme: shell?.getAttribute("data-admin-theme"),
      adminCard: shellCs?.getPropertyValue("--admin-card").trim(),
      cardBg: cardCs?.backgroundColor ?? null,
      shellBg: shellCs?.backgroundColor ?? null,
    };
  });

  const file = path.join(outDir, `dark-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  results.push({ name, file, ...metrics });
  console.log(" ", metrics);
}

fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
await browser.close();

const bad = results.filter(
  (r) => r.dataTheme !== "dark" || !String(r.adminCard || "").includes("1c2030")
);
console.log(bad.length ? "WARN some pages not fully dark" : "All pages dark theme OK");
process.exit(bad.length ? 1 : 0);
