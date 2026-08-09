import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const base = process.env.PROBE_BASE_URL || "http://localhost:3001";
const outDir = path.join(process.cwd(), "tmp", "admin-design-evidence");
fs.mkdirSync(outDir, { recursive: true });

async function measureSettings(page, label) {
  await page.waitForSelector("#probe-settings-root", { timeout: 60000 });
  const data = await page.evaluate(() => {
    const spacer = document.querySelector('[data-testid="sidebar-spacer"]');
    const sr = spacer?.getBoundingClientRect();
    const ss = spacer ? getComputedStyle(spacer) : null;

    function cardByTitle(re) {
      const titles = [...document.querySelectorAll("h1,h2,h3,[class*='CardTitle']")];
      const t = titles.find((el) => re.test((el.textContent || "").trim()));
      if (!t) return null;
      let el = t;
      while (el && el.id !== "probe-settings-root") {
        if (String(el.className || "").includes("rounded") || el.getAttribute("data-probe-section")) {
          break;
        }
        el = el.parentElement;
      }
      const r = (el || t).getBoundingClientRect();
      return {
        title: (t.textContent || "").trim(),
        top: Math.round(r.top + window.scrollY),
        bottom: Math.round(r.bottom + window.scrollY),
        height: Math.round(r.height),
      };
    }

    const rd = cardByTitle(/Restaurant Details/);
    const pr = cardByTitle(/Payment Rules/);
    const brand = cardByTitle(/Brand Settings/);
    const orderTypes = cardByTitle(/Order Types/);

    const main = document.querySelector("#probe-main");
    const ms = main ? getComputedStyle(main) : null;

    const emptyTall = [];
    document.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 400) return;
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length > 0) return;
      const s = getComputedStyle(el);
      if (s.display === "none") return;
      emptyTall.push({
        className: String(el.className || "").slice(0, 160),
        height: Math.round(r.height),
        width: Math.round(r.width),
        alignSelf: s.alignSelf,
        overflow: s.overflow,
        minHeight: s.minHeight,
      });
    });

    return {
      layoutMode: document.querySelector("[data-layout-mode]")?.getAttribute("data-layout-mode"),
      scrollHeight: document.documentElement.scrollHeight,
      spacer: spacer
        ? {
            height: Math.round(sr.height),
            width: Math.round(sr.width),
            alignSelf: ss.alignSelf,
            heightCss: ss.height,
            minHeight: ss.minHeight,
            overflow: ss.overflow,
            className: String(spacer.className),
          }
        : null,
      mainOverflow: ms
        ? { overflow: ms.overflow, overflowX: ms.overflowX, overflowY: ms.overflowY }
        : null,
      cards: { restaurantDetails: rd, brandSettings: brand, orderTypes, paymentRules: pr },
      gapRestaurantToPayment: rd && pr ? pr.top - rd.bottom : null,
      emptyTall,
    };
  });

  const mid =
    data.cards.restaurantDetails && data.cards.paymentRules
      ? Math.max(
          0,
          Math.round(
            (data.cards.restaurantDetails.bottom + data.cards.paymentRules.top) / 2 - 400
          )
        )
      : 800;
  await page.evaluate((y) => window.scrollTo(0, y), mid);
  await page.screenshot({
    path: path.join(outDir, `settings-${label}-region.png`),
    fullPage: false,
  });
  fs.writeFileSync(path.join(outDir, `settings-${label}.json`), JSON.stringify(data, null, 2));
  return data;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

console.log("Measuring BROKEN (prod-equivalent) layout…");
await page.goto(`${base}/dev/settings-probe?layout=broken`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
const before = await measureSettings(page, "before-broken");

console.log("Measuring FIXED layout…");
await page.goto(`${base}/dev/settings-probe?layout=fixed`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
const after = await measureSettings(page, "after-fixed");

console.log("Capturing menu probe screenshots…");
await page.goto(`${base}/dev/menu-probe`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForSelector("text=Menu", { timeout: 30000 });

// BEFORE: force legacy price colors (gold primary / muted gray) for visual comparison
await page.getByRole("tab", { name: "Menu Items" }).click();
await page.waitForTimeout(200);
await page.evaluate(() => {
  document.querySelectorAll("p, span").forEach((el) => {
    const t = (el.textContent || "").trim();
    if (!/\$|SLSH|So\.|^\d/.test(t) && !t.includes(".")) return;
    if (!/\d/.test(t)) return;
    if (el.closest("[role='tablist']")) return;
    el.setAttribute("data-price-el", "1");
    el.className = "whitespace-nowrap font-bold text-primary";
  });
});
await page.screenshot({
  path: path.join(outDir, "menu-items-prices-BEFORE.png"),
  fullPage: false,
});

await page.getByRole("tab", { name: "Add-ons" }).click();
await page.waitForTimeout(200);
await page.evaluate(() => {
  document.querySelectorAll("p, span").forEach((el) => {
    const t = (el.textContent || "").trim();
    if (!/\d/.test(t)) return;
    if (el.closest("[role='tablist']")) return;
    el.className = "text-muted-foreground";
  });
});
await page.screenshot({
  path: path.join(outDir, "menu-addons-prices-BEFORE.png"),
  fullPage: false,
});

// AFTER: reload real styles
await page.goto(`${base}/dev/menu-probe`, { waitUntil: "networkidle", timeout: 90000 });
const tabOrder = await page.evaluate(() =>
  [...document.querySelectorAll('[role="tab"]')].map((el) => (el.textContent || "").trim())
);
fs.writeFileSync(path.join(outDir, "menu-tab-order.json"), JSON.stringify(tabOrder, null, 2));

await page.screenshot({
  path: path.join(outDir, "menu-tabs-AFTER-order.png"),
  fullPage: false,
});

await page.getByRole("tab", { name: "Menu Items" }).click();
await page.waitForTimeout(200);
await page.screenshot({
  path: path.join(outDir, "menu-items-prices-AFTER.png"),
  fullPage: false,
});

await page.getByRole("tab", { name: "Add-ons" }).click();
await page.waitForTimeout(200);
await page.screenshot({
  path: path.join(outDir, "menu-addons-prices-AFTER.png"),
  fullPage: false,
});

const priceColors = await page.evaluate(() => {
  const brand = getComputedStyle(document.documentElement)
    .getPropertyValue("--admin-brand")
    .trim();
  // walk from provider
  const root = document.querySelector("[style*='--admin-brand']") || document.body;
  const brandVar = getComputedStyle(root).getPropertyValue("--admin-brand").trim();
  const prices = [...document.querySelectorAll("p, span")].filter((el) => {
    const t = (el.textContent || "").trim();
    return /\d/.test(t) && (el.className || "").toString().includes("admin-brand") ||
      (/\d/.test(t) && getComputedStyle(el).fontWeight >= "600");
  });
  return {
    brandVar: brandVar || brand,
    samples: [...document.querySelectorAll("span.font-bold, p.font-bold")].slice(0, 8).map((el) => ({
      text: (el.textContent || "").trim().slice(0, 40),
      color: getComputedStyle(el).color,
      className: String(el.className || "").slice(0, 140),
    })),
  };
});
fs.writeFileSync(path.join(outDir, "menu-price-colors.json"), JSON.stringify(priceColors, null, 2));

const summary = {
  outDir,
  before: {
    spacerHeight: before.spacer?.height,
    spacerAlignSelf: before.spacer?.alignSelf,
    mainOverflow: before.mainOverflow,
    emptyTall: before.emptyTall,
    gapRestaurantToPayment: before.gapRestaurantToPayment,
  },
  after: {
    spacerHeight: after.spacer?.height,
    spacerAlignSelf: after.spacer?.alignSelf,
    mainOverflow: after.mainOverflow,
    emptyTall: after.emptyTall,
    gapRestaurantToPayment: after.gapRestaurantToPayment,
  },
  priceColors,
};
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
