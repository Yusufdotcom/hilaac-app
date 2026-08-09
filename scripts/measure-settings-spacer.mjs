import { chromium } from "playwright-core";

const base = process.env.PROBE_BASE_URL || "http://localhost:3001";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/dev/settings-probe`, { waitUntil: "networkidle" });

const result = await page.evaluate(() => {
  const spacer = document.querySelector('[aria-hidden="true"]');
  const cs = spacer ? getComputedStyle(spacer) : null;
  const r = spacer ? spacer.getBoundingClientRect() : null;

  const overflowScrollports = [];
  document.querySelectorAll("*").forEach((el) => {
    const s = getComputedStyle(el);
    const oy = s.overflowY;
    if (oy === "auto" || oy === "scroll") {
      const br = el.getBoundingClientRect();
      if (br.height > 80) {
        overflowScrollports.push({
          className: String(el.className || "").slice(0, 140),
          overflow: s.overflow,
          overflowX: s.overflowX,
          overflowY: s.overflowY,
          h: Math.round(br.height),
          w: Math.round(br.width),
        });
      }
    }
  });

  const main = document.querySelector("#probe-main");
  const kids = main ? [...main.children] : [];
  const gaps = [];
  for (let i = 0; i < kids.length - 1; i++) {
    const a = kids[i].getBoundingClientRect();
    const b = kids[i + 1].getBoundingClientRect();
    const gap = b.top - a.bottom;
    if (gap > 24) {
      gaps.push({
        i,
        gap: Math.round(gap),
        a: String(kids[i].className || "").slice(0, 100),
        b: String(kids[i + 1].className || "").slice(0, 100),
      });
    }
  }

  // Empty tall nodes (the previous culprit signature)
  const emptyTall = [];
  document.querySelectorAll("*").forEach((el) => {
    const br = el.getBoundingClientRect();
    if (br.height < 400) return;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > 0) return;
    const s = getComputedStyle(el);
    if (s.display === "none") return;
    emptyTall.push({
      className: String(el.className || "").slice(0, 140),
      h: Math.round(br.height),
      w: Math.round(br.width),
      top: Math.round(br.top + window.scrollY),
      alignSelf: s.alignSelf,
      overflow: s.overflow,
    });
  });

  return {
    spacer: spacer
      ? {
          h: Math.round(r.height),
          w: Math.round(r.width),
          top: Math.round(r.top),
          alignSelf: cs.alignSelf,
          minHeight: cs.minHeight,
          height: cs.height,
          display: cs.display,
          className: String(spacer.className || ""),
        }
      : null,
    scrollHeight: document.documentElement.scrollHeight,
    overflowScrollports,
    largeChildGaps: gaps,
    emptyTall,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
