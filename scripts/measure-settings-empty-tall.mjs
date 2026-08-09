/**
 * Find tall/empty DOM nodes on Settings probe (and optionally any URL).
 * Uses system Chrome via playwright-core.
 */
import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const base = (process.env.PROBE_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const url = process.env.PROBE_URL || `${base}/dev/settings-probe`;
const outDir = join(process.cwd(), "tmp");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForTimeout(2500);

const report = await page.evaluate(() => {
  const suspicious = [];
  const all = [];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let el;
  while ((el = walker.nextNode())) {
    const r = el.getBoundingClientRect();
    if (r.height < 120 || r.width < 40) continue;
    if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;

    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;

    const text = (el.innerText || "").replace(/\s+/g, " ").trim();
    const textLen = text.length;
    const absTop = Math.round(r.top + window.scrollY);
    const entry = {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      role: el.getAttribute("role") || undefined,
      className: (typeof el.className === "string" ? el.className : "").slice(0, 140),
      height: Math.round(r.height),
      width: Math.round(r.width),
      top: absTop,
      bottom: Math.round(r.bottom + window.scrollY),
      textLen,
      textPreview: text.slice(0, 100),
      display: cs.display,
      position: cs.position,
      flexGrow: cs.flexGrow,
      minHeight: cs.minHeight,
      aspectRatio: cs.aspectRatio,
      overflow: cs.overflow,
      bg: cs.backgroundColor,
      opacity: cs.opacity,
      childCount: el.childElementCount,
    };
    all.push(entry);

    // Tall with little text = blank stretch candidates
    const density = textLen / Math.max(r.height, 1);
    if (r.height >= 200 && density < 0.15) {
      suspicious.push({ ...entry, density: Number(density.toFixed(3)), reason: "tall-low-text-density" });
    }
    if (r.height >= 200 && textLen < 8) {
      suspicious.push({ ...entry, density: Number(density.toFixed(3)), reason: "tall-almost-empty-text" });
    }
    if (cs.minHeight && cs.minHeight !== "0px" && parseFloat(cs.minHeight) >= 200) {
      suspicious.push({ ...entry, reason: "large-min-height" });
    }
    if (cs.aspectRatio && cs.aspectRatio !== "auto" && r.height >= 160) {
      suspicious.push({ ...entry, reason: `aspect-ratio:${cs.aspectRatio}` });
    }
  }

  // Sibling gap scan for main content column
  const roots = [
    document.querySelector("#probe-settings-root"),
    document.querySelector("main .max-w-7xl"),
    document.querySelector("main"),
  ].filter(Boolean);

  const siblingGaps = [];
  for (const root of roots) {
    const kids = [...root.children];
    for (let i = 0; i < kids.length - 1; i++) {
      const a = kids[i].getBoundingClientRect();
      const b = kids[i + 1].getBoundingClientRect();
      const gap = Math.round(b.top - a.bottom);
      if (gap >= 48) {
        siblingGaps.push({
          root: root.id || root.className?.toString?.().slice(0, 60),
          gap,
          a: (kids[i].innerText || "").slice(0, 60).replace(/\s+/g, " "),
          b: (kids[i + 1].innerText || "").slice(0, 60).replace(/\s+/g, " "),
          aHeight: Math.round(a.height),
          bHeight: Math.round(b.height),
          aTop: Math.round(a.top + window.scrollY),
        });
      }
    }
  }

  suspicious.sort((a, b) => b.height - a.height);

  return {
    url: location.href,
    scrollHeight: document.documentElement.scrollHeight,
    suspicious: suspicious.slice(0, 40),
    siblingGaps,
    tallest: all.sort((a, b) => b.height - a.height).slice(0, 20),
  };
});

writeFileSync(join(outDir, "settings-empty-tall.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
