/**
 * Measure DOM/computed styles around Settings sections
 * (Restaurant Details → Payment Rules) for blank-gap evidence.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const base = process.env.PROBE_BASE_URL || "http://localhost:3001";
const outDir = path.join(process.cwd(), "tmp", "settings-gap-evidence");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/dev/settings-probe`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForSelector("#probe-settings-root", { timeout: 60000 });

const evidence = await page.evaluate(() => {
  function info(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className: String(el.className || "").slice(0, 180),
      textPreview: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
      textLen: (el.textContent || "").replace(/\s+/g, " ").trim().length,
      top: Math.round(r.top + window.scrollY),
      bottom: Math.round(r.bottom + window.scrollY),
      height: Math.round(r.height),
      width: Math.round(r.width),
      display: s.display,
      position: s.position,
      flexGrow: s.flexGrow,
      alignSelf: s.alignSelf,
      minHeight: s.minHeight,
      heightCss: s.height,
      overflow: s.overflow,
      overflowX: s.overflowX,
      overflowY: s.overflowY,
      marginTop: s.marginTop,
      marginBottom: s.marginBottom,
      paddingTop: s.paddingTop,
      paddingBottom: s.paddingBottom,
      gap: s.gap,
      rowGap: s.rowGap,
      background: s.backgroundColor,
    };
  }

  const cards = [...document.querySelectorAll("#probe-settings-root .rounded-xl, #probe-settings-root [class*='rounded-lg']")]
    .filter((el) => {
      const t = (el.textContent || "").slice(0, 200);
      return /Restaurant Details|Brand Settings|Order Types|Payment Rules|Payment Mode|Manage Branches|Loyalty|WhatsApp|MFA|Two-factor/i.test(t);
    })
    .map((el) => {
      const title =
        el.querySelector("h2,h3,[class*='CardTitle']")?.textContent?.trim() ||
        (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
      return { title, ...info(el) };
    });

  // Prefer Card roots by heading text
  const headings = [...document.querySelectorAll("#probe-settings-root h1, #probe-settings-root h2, #probe-settings-root h3, #probe-settings-root [class*='CardTitle']")];
  const headingInfos = headings.map((h) => {
    const card = h.closest("[class*='rounded']") || h.parentElement;
    return {
      heading: (h.textContent || "").trim(),
      headingBox: info(h),
      card: info(card),
    };
  });

  const root = document.querySelector("#probe-settings-root");
  const rootKids = root ? [...root.children].map((c, i) => ({ i, ...info(c) })) : [];

  // Gaps between consecutive root children
  const gaps = [];
  if (root) {
    const kids = [...root.children];
    for (let i = 0; i < kids.length - 1; i++) {
      const a = kids[i].getBoundingClientRect();
      const b = kids[i + 1].getBoundingClientRect();
      const gapPx = Math.round(b.top - a.bottom);
      gaps.push({
        from: (kids[i].textContent || "").replace(/\s+/g, " ").trim().slice(0, 50),
        to: (kids[i + 1].textContent || "").replace(/\s+/g, " ").trim().slice(0, 50),
        gapPx,
        fromBottom: Math.round(a.bottom + window.scrollY),
        toTop: Math.round(b.top + window.scrollY),
      });
    }
  }

  // Find Restaurant Details and Payment Rules specifically
  function findByText(re) {
    const all = [...document.querySelectorAll("#probe-settings-root *")];
    const hit = all.find((el) => re.test((el.textContent || "").trim()) && (el.children.length === 0 || el.matches("h1,h2,h3,div,span,p")));
    // walk up to card
    let el = all.find((n) => {
      const t = (n.textContent || "").replace(/\s+/g, " ").trim();
      return re.test(t) && t.length < 80;
    });
    if (!el) return null;
    while (el && el !== root) {
      if (el.className && /rounded|border|card/i.test(String(el.className))) break;
      el = el.parentElement;
    }
    return info(el);
  }

  const restaurantDetails = findByText(/^Restaurant Details$/);
  const paymentRules = findByText(/Payment Rules/);

  let regionGap = null;
  if (restaurantDetails && paymentRules) {
    regionGap = {
      restaurantDetails,
      paymentRules,
      gapBetweenThemPx: paymentRules.top - restaurantDetails.bottom,
      scrollYForMid: Math.round((restaurantDetails.bottom + paymentRules.top) / 2 - 450),
    };
  }

  // Empty tall nodes in the region between RD and Payment Rules (or whole page)
  const emptyTall = [];
  const regionTop = restaurantDetails?.bottom ?? 0;
  const regionBottom = paymentRules?.top ?? document.documentElement.scrollHeight;
  document.querySelectorAll("*").forEach((el) => {
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const bottom = r.bottom + window.scrollY;
    const h = r.height;
    if (h < 80) return;
    // overlapping the suspected blank band
    if (bottom < regionTop - 20 || top > regionBottom + 20) {
      // also keep page-level empty monsters
      if (h < 800 || (el.textContent || "").replace(/\s+/g, " ").trim().length > 0) return;
    }
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > 0 && h < 800) return;
    if (text.length === 0 && h >= 80) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return;
      emptyTall.push({
        ...info(el),
        overlapsRegion: !(bottom < regionTop || top > regionBottom),
      });
    }
  });

  const spacer = document.querySelector('[aria-hidden="true"]');

  // Sample what's visually in the gap band (elements whose box intersects mid-gap Y)
  let bandSample = [];
  if (regionGap && regionGap.gapBetweenThemPx > 40) {
    const midY = (restaurantDetails.bottom + paymentRules.top) / 2;
    bandSample = [...document.querySelectorAll("*")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const top = r.top + window.scrollY;
        const bottom = r.bottom + window.scrollY;
        if (top > midY || bottom < midY) return null;
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        return {
          ...info(el),
          textLen: text.length,
          textPreview: text.slice(0, 60),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.height - b.height)
      .slice(0, 25);
  }

  return {
    scrollHeight: document.documentElement.scrollHeight,
    root: info(root),
    rootKids,
    gaps,
    headingInfos,
    regionGap,
    spacer: info(spacer),
    emptyTall: emptyTall.slice(0, 30),
    bandSample,
  };
});

// Screenshot full page + region
const rg = evidence.regionGap;
if (rg) {
  const scrollY = Math.max(0, rg.scrollYForMid);
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.screenshot({
    path: path.join(outDir, "region-viewport.png"),
    fullPage: false,
  });
}
await page.screenshot({
  path: path.join(outDir, "full-page.png"),
  fullPage: true,
});

fs.writeFileSync(path.join(outDir, "evidence.json"), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({
  outDir,
  scrollHeight: evidence.scrollHeight,
  gaps: evidence.gaps,
  regionGapPx: evidence.regionGap?.gapBetweenThemPx ?? null,
  spacerHeight: evidence.spacer?.height ?? null,
  spacerAlignSelf: evidence.spacer?.alignSelf ?? null,
  emptyTallCount: evidence.emptyTall.length,
  emptyTall: evidence.emptyTall.slice(0, 5).map((e) => ({
    h: e.height,
    className: e.className,
    alignSelf: e.alignSelf,
    overlapsRegion: e.overlapsRegion,
  })),
}, null, 2));

await browser.close();
