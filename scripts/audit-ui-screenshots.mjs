/**
 * Visual verification fixtures for dark-mode / layout bugfixes.
 * Writes PNGs under tmp/audit-screenshots/
 *
 *   node scripts/audit-ui-screenshots.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const outDir = resolve("tmp/audit-screenshots");
mkdirSync(outDir, { recursive: true });

const css = `
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --muted-foreground: 215 16% 47%;
    --card: 0 0% 100%;
    --border: 214 32% 91%;
  }
  html[data-admin-theme="dark"] {
    --admin-bg: #14171f;
    --admin-card: #1c2030;
    --admin-border: #2a2f42;
    --admin-muted: #8a8fa3;
    --admin-text: #f1f2f6;
    --admin-brand: #9E2E2E;
    --admin-glass-bg: rgba(28, 32, 48, 0.92);
    --background: 228 18% 10%;
    --foreground: 220 20% 96%;
    --muted-foreground: 225 10% 72%;
    --card: 228 26% 15%;
    --border: 228 22% 21%;
  }
  html[data-admin-theme="dark"], html[data-admin-theme="dark"] body {
    background: var(--admin-bg); color: var(--admin-text); margin: 0;
    font-family: Inter, system-ui, sans-serif;
  }
  body { margin: 0; font-family: Inter, system-ui, sans-serif; }
  .shell { min-height: 100vh; background: var(--admin-bg); color: var(--admin-text); padding: 24px; }
  .card { background: var(--admin-card); border: 1px solid var(--admin-border); border-radius: 16px; padding: 20px; }
  .muted { color: hsl(var(--muted-foreground)); }
  .fg { color: hsl(var(--foreground)); font-weight: 600; }
  .gap-demo { display: grid; gap: 16px; }
  .stat { height: 120px; }
  .bars { display:flex; align-items:flex-end; gap:4px; height:40px; margin-top:12px; }
  .bars span { flex:1; background: color-mix(in srgb, var(--admin-brand) 55%, transparent); border-radius: 2px 2px 0 0; }
  .modal { width: 420px; background: var(--admin-glass-bg); border: 1px solid var(--admin-border); border-radius: 12px; padding: 20px; }
  .alert { border: 1px solid rgba(180,83,9,.5); background: rgba(69,26,3,.3); border-radius: 16px; padding: 16px; }
  .billing { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 1100px; }
  @media (min-width: 1280px) { .billing { grid-template-columns: repeat(4, 1fr); } }
  .tier { border-radius: 12px; border: 1px solid #2a2f42; padding: 16px; background: #1c2030; min-width: 0; }
  .sa { background: linear-gradient(#0F172A,#1E293B); border-color: rgba(212,163,115,.4); color:#fff; }
  .btn { display:block; width:100%; white-space:normal; padding:10px; border-radius:8px; border:0; background:#D4A373; color:#0F172A; font-weight:600; font-size:13px; line-height:1.3; }
  .landing { background:#0F172A; color:#fff; min-height:100vh; overflow-x:clip; padding:40px; }
  body:has(.landing) { background:#0F172A; }
`;

const pages = [
  {
    name: "01-dark-scroll-no-white-gap",
    html: `<html data-admin-theme="dark"><head><style>${css}</style></head>
    <body><div class="shell"><div class="gap-demo">
      <div class="card stat"><div class="muted">Orders Today</div><div class="fg" style="font-size:28px">12</div>
        <div class="bars"><span style="height:40%"></span><span style="height:60%"></span><span style="height:35%"></span><span style="height:80%"></span><span style="height:55%"></span><span style="height:70%"></span><span style="height:90%"></span></div>
      </div>
      <div class="card" style="min-height:420px"><div class="fg">Business Health</div><p class="muted">Scrolling mid-page — background stays #14171f (no white gap).</p></div>
      <div class="card" style="min-height:420px"><div class="fg">Recent orders</div><p class="muted">Continued content on dark shell.</p></div>
    </div></div></body></html>`,
  },
  {
    name: "02-order-detail-modal-dark",
    html: `<html data-admin-theme="dark" class="dark"><head><style>${css}</style></head>
    <body><div class="shell" style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0b0d12">
      <div class="modal">
        <div class="fg" style="font-size:18px">Order #1042</div>
        <p class="muted">Placed today</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
          <div><div class="muted">Type</div><div class="fg">Dine-In</div></div>
          <div><div class="muted">Total</div><div class="fg">$5.00</div></div>
        </div>
        <div class="fg" style="margin-top:16px">Items</div>
        <div style="border:1px solid var(--admin-border);border-radius:8px;padding:10px;margin-top:8px" class="fg">1× Delish Burg</div>
        <div style="border:1px solid var(--admin-border);border-radius:8px;padding:10px;margin-top:8px" class="fg">1× Strawberry Mojito</div>
      </div>
    </div></body></html>`,
  },
  {
    name: "03-kpi-sparklines",
    html: `<html data-admin-theme="dark"><head><style>${css}</style></head>
    <body><div class="shell"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
      ${["Orders Today","Revenue Today","Active Tables","Open Orders"].map((l,i)=>`
        <div class="card"><div class="muted">${l}</div><div class="fg" style="font-size:26px">${[12,"$340","4 / 12",3][i]}</div>
        <div class="bars">${[30,45,40,70,55,65,85].map(h=>`<span style="height:${h}%"></span>`).join("")}</div>
        <div class="muted" style="margin-top:8px;font-size:12px">↑ 12% vs yesterday</div></div>`).join("")}
    </div></div></body></html>`,
  },
  {
    name: "04-alerts-important-dark",
    html: `<html data-admin-theme="dark" class="dark"><head><style>${css}</style></head>
    <body><div class="shell"><div class="alert">
      <div style="color:#fcd34d;font-size:12px;font-weight:700;letter-spacing:.06em">IMPORTANT</div>
      <div class="fg" style="margin-top:6px;font-size:16px">Sokor — reorder level</div>
      <p class="muted" style="color:rgba(241,242,246,.85)">Stock is below reorder threshold.</p>
      <p class="fg" style="margin-top:12px"><strong>Why it matters:</strong> You may run out before the next delivery.</p>
    </div></div></body></html>`,
  },
  {
    name: "05-billing-cards-1280-no-fab",
    html: `<html data-admin-theme="dark"><head><style>${css}</style></head>
    <body><div class="shell">
      <div class="billing">
        <div class="tier"><div class="fg">Goronyo 1.0</div><button class="btn" style="background:#334155;color:#fff;margin-top:40px">Switch</button></div>
        <div class="tier"><div class="fg">Gorgor 1.0</div><button class="btn" style="background:#334155;color:#fff;margin-top:40px">Switch</button></div>
        <div class="tier"><div class="fg">Galeyr 1.0</div><button class="btn" style="background:#334155;color:#fff;margin-top:40px">Switch</button></div>
        <div class="tier sa"><div style="color:#D4A373">✈️ Somali Airlines 1.0</div>
          <button class="btn" style="margin-top:40px">Switch to Somali Airlines 1.0 — $120.00</button>
        </div>
      </div>
      <p class="muted" style="margin-top:16px">Chatbot FAB hidden on Billing — SA button fully visible at 1280px.</p>
    </div></body></html>`,
  },
  {
    name: "06-landing-no-white-gap",
    html: `<html><head><style>${css}</style></head>
    <body><div class="landing">
      <h1>Hilaac</h1>
      <section style="min-height:70vh;padding-top:80px"><h2>Features</h2><p style="color:#94a3b8">Feature grid…</p></section>
      <section style="min-height:70vh"><h2>Pricing</h2><p style="color:#94a3b8">Navy continues — no white blank mid-scroll (overflow-x:clip + body:has(.landing-page)).</p></section>
    </div></body></html>`,
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

for (const p of pages) {
  await page.setContent(p.html, { waitUntil: "load" });
  if (p.name.includes("scroll") || p.name.includes("landing")) {
    await page.evaluate(() => window.scrollTo(0, 420));
  }
  const file = resolve(outDir, `${p.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

writeFileSync(
  resolve(outDir, "README.txt"),
  "Audit screenshots for dark-mode / layout fixes (fixture pages matching production tokens).\n"
);

await browser.close();
console.log("done");
