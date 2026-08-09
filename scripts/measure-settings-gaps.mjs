/**
 * Measure Settings layout gaps via Playwright against /dev/settings-probe
 * Run: npm run dev (separate), then node scripts/measure-settings-gaps.mjs
 */
import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const base = (process.env.PROBE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const outDir = join(process.cwd(), "tmp");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${base}/dev/settings-probe`, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForSelector("#probe-settings-root", { timeout: 60_000 });
await page.waitForTimeout(1500);

const report = await page.evaluate(() => {
  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      probe: el.getAttribute("data-probe-section"),
      className: (el.className || "").toString().slice(0, 160),
      top: Math.round(r.top + window.scrollY),
      bottom: Math.round(r.bottom + window.scrollY),
      height: Math.round(r.height),
      width: Math.round(r.width),
      display: cs.display,
      position: cs.position,
      marginTop: cs.marginTop,
      marginBottom: cs.marginBottom,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      minHeight: cs.minHeight,
      flex: cs.flex,
      flexGrow: cs.flexGrow,
      aspectRatio: cs.aspectRatio,
      overflow: cs.overflow,
      visibility: cs.visibility,
      opacity: cs.opacity,
    };
  }

  const main = document.querySelector("#probe-main");
  const content = document.querySelector("#probe-content");
  const root = document.querySelector("#probe-settings-root");
  const sections = [...document.querySelectorAll("[data-probe-section]")];
  const cards = [...document.querySelectorAll("#probe-settings-root .rounded-xl.border, #probe-settings-root [class*='rounded-xl']")].filter(
    (el) => el.querySelector("h3, [class*='CardTitle'], .text-lg")
  );

  // Prefer direct children of settings-form + section wrappers
  const formRoot = document.querySelector("[data-probe-section='settings-form'] > div");
  const formCards = formRoot ? [...formRoot.children] : [];

  const allBlocks = [];
  for (const s of sections) {
    if (s.getAttribute("data-probe-section") === "settings-form") {
      for (const child of formCards) {
        allBlocks.push({ label: `settings-form > ${child.querySelector("h3,.text-lg")?.textContent?.trim() || child.className.slice(0, 40)}`, el: child });
      }
    } else {
      allBlocks.push({
        label: s.getAttribute("data-probe-section"),
        el: s,
      });
    }
  }

  const blockBoxes = allBlocks.map(({ label, el }) => ({ label, ...box(el) }));

  const gaps = [];
  for (let i = 0; i < blockBoxes.length - 1; i++) {
    const a = blockBoxes[i];
    const b = blockBoxes[i + 1];
    const gap = b.top - a.bottom;
    gaps.push({
      between: `${a.label} → ${b.label}`,
      gapPx: gap,
      aBottom: a.bottom,
      bTop: b.top,
      aHeight: a.height,
      bHeight: b.height,
    });
  }

  // Find unusually tall elements inside settings root
  const tall = [];
  const walk = (el, depth = 0) => {
    if (!el || depth > 12) return;
    const r = el.getBoundingClientRect();
    if (r.height >= 280 && el.children) {
      tall.push({
        depth,
        height: Math.round(r.height),
        tag: el.tagName.toLowerCase(),
        className: (el.className || "").toString().slice(0, 120),
        text: (el.innerText || "").slice(0, 80).replace(/\s+/g, " "),
        ...box(el),
      });
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(root);

  // Radio items specifically
  const radios = [...document.querySelectorAll('[role="radio"], button[role="radio"]')].map((el) => box(el));

  // Space after last block before footer
  const footer = document.querySelector("#probe-main > :last-child");
  const last = blockBoxes[blockBoxes.length - 1];
  const footerBox = box(footer);

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    scrollHeight: document.documentElement.scrollHeight,
    main: box(main),
    content: box(content),
    root: box(root),
    blocks: blockBoxes,
    gaps: gaps.sort((a, b) => b.gapPx - a.gapPx),
    largestGaps: gaps.filter((g) => g.gapPx > 40),
    tallElements: tall.sort((a, b) => b.height - a.height).slice(0, 25),
    radios,
    footerGap: last && footerBox ? footerBox.top - last.bottom : null,
    footer: footerBox,
  };
});

// Screenshots at key scroll positions (largest gaps)
const shots = [];
for (const g of report.largestGaps.slice(0, 3)) {
  const y = Math.max(0, g.aBottom - 120);
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await page.waitForTimeout(300);
  const path = join(outDir, `settings-gap-${shots.length}.png`);
  await page.screenshot({ path, fullPage: false });
  shots.push({ file: path, gap: g });
}

const fullPath = join(outDir, "settings-probe-full.png");
await page.screenshot({ path: fullPath, fullPage: true });

const jsonPath = join(outDir, "settings-gaps-report.json");
writeFileSync(jsonPath, JSON.stringify({ ...report, shots }, null, 2));

console.log("=== Settings gap measurement ===");
console.log("scrollHeight", report.scrollHeight, "mainHeight", report.main?.height, "rootHeight", report.root?.height);
console.log("\nGaps between sections (px):");
for (const g of report.gaps) {
  const flag = g.gapPx > 40 ? " <<<< LARGE" : "";
  console.log(`  ${g.gapPx.toString().padStart(5)}  ${g.between}${flag}`);
}
console.log("\nFooter gap after last section:", report.footerGap);
console.log("\nTallest elements (>=280px):");
for (const t of report.tallElements.slice(0, 12)) {
  console.log(`  h=${t.height}  ${t.tag}.${t.className}`);
  console.log(`         text: ${t.text}`);
}
console.log("\nRadio sizes:", report.radios.map((r) => `${r?.height}x${r?.width}`).join(", "));
console.log("\nWrote", jsonPath);
console.log("Wrote", fullPath);
for (const s of shots) console.log("Wrote", s.file, s.gap.between, s.gap.gapPx + "px");

await browser.close();
