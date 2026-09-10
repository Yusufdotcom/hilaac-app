const { mkdirSync, writeFileSync } = require("fs");
const { resolve } = require("path");
const { spawnSync } = require("child_process");

const outDir = resolve("tmp/audit-screenshots");
mkdirSync(outDir, { recursive: true });

const chrome =
  process.env.CHROME_PATH ||
  "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe";

const css = `html,body{margin:0;font-family:Inter,system-ui,sans-serif}
html[data-admin-theme=dark],html[data-admin-theme=dark] body{background:#14171f;color:#f1f2f6}
.shell{min-height:100vh;background:#14171f;color:#f1f2f6;padding:24px}
.card{background:#1c2030;border:1px solid #2a2f42;border-radius:16px;padding:20px}
.muted{color:#8a8fa3}.fg{color:#f1f2f6;font-weight:600}
.bars{display:flex;align-items:flex-end;gap:4px;height:40px;margin-top:12px}
.bars span{flex:1;background:rgba(158,46,46,.55);border-radius:2px 2px 0 0}
.modal{width:420px;background:rgba(28,32,48,.95);border:1px solid #2a2f42;border-radius:12px;padding:20px}
.alert{border:1px solid rgba(180,83,9,.5);background:rgba(69,26,3,.35);border-radius:16px;padding:16px}
.billing{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:1180px}
.tier{border-radius:12px;border:1px solid #2a2f42;padding:16px;background:#1c2030;min-width:0}
.sa{background:linear-gradient(#0F172A,#1E293B);border-color:rgba(212,163,115,.4)}
.btn{display:block;width:100%;white-space:normal;padding:10px;border-radius:8px;border:0;background:#D4A373;color:#0F172A;font-weight:600;font-size:13px;line-height:1.3}
.landing{background:#0F172A;color:#fff;min-height:140vh;overflow-x:clip;padding:40px}
body:has(.landing){background:#0F172A}`;

const pages = {
  "01-dark-scroll-no-white-gap": `<!doctype html><html data-admin-theme=dark><head><style>${css}</style></head><body><div class=shell>
<div class=card style="margin-bottom:16px"><div class=muted>Orders Today</div><div class=fg style="font-size:28px">12</div>
<div class=bars><span style="height:40%"></span><span style="height:70%"></span><span style="height:55%"></span><span style="height:80%"></span><span style="height:60%"></span><span style="height:75%"></span><span style="height:90%"></span></div></div>
<div class=card style="min-height:380px;margin-bottom:16px"><div class=fg>Business Health</div><p class=muted>Mid-scroll — shell bg #14171f, body matches (no white gap).</p></div>
<div class=card style="min-height:380px"><div class=fg>Recent orders</div><p class=muted>Continued dark content.</p></div>
</div><script>scrollTo(0,360)</script></body></html>`,
  "02-order-detail-modal-dark": `<!doctype html><html data-admin-theme=dark><head><style>${css}</style></head><body><div class=shell style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0b0d12">
<div class=modal><div class=fg style="font-size:18px">Order #1042</div><p class=muted>Placed today</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
<div><div class=muted>Type</div><div class=fg>Dine-In</div></div>
<div><div class=muted>Total</div><div class=fg>$5.00</div></div></div>
<div class=fg style="margin-top:16px">Items</div>
<div style="border:1px solid #2a2f42;border-radius:8px;padding:10px;margin-top:8px" class=fg>1× Delish Burg</div>
<div style="border:1px solid #2a2f42;border-radius:8px;padding:10px;margin-top:8px" class=fg>1× Strawberry Mojito</div>
</div></div></body></html>`,
  "03-kpi-sparklines": `<!doctype html><html data-admin-theme=dark><head><style>${css}</style></head><body><div class=shell>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
${["Orders Today|12","Revenue Today|$340","Active Tables|4 / 12","Open Orders|3"].map((pair)=>{const [l,v]=pair.split("|");return `<div class=card><div class=muted>${l}</div><div class=fg style="font-size:26px">${v}</div><div class=bars><span style="height:30%"></span><span style="height:45%"></span><span style="height:40%"></span><span style="height:70%"></span><span style="height:55%"></span><span style="height:65%"></span><span style="height:85%"></span></div><div class=muted style="margin-top:8px;font-size:12px">↑ 12% vs yesterday</div></div>`;}).join("")}
</div></div></body></html>`,
  "04-alerts-important-dark": `<!doctype html><html data-admin-theme=dark><head><style>${css}</style></head><body><div class=shell>
<div class=alert><div style="color:#fcd34d;font-size:12px;font-weight:700">IMPORTANT</div>
<div class=fg style="margin-top:6px;font-size:16px">Sokor — reorder level</div>
<p class=muted style="color:rgba(241,242,246,.85)">Stock is below reorder threshold.</p>
<p class=fg style="margin-top:12px"><strong>Why it matters:</strong> You may run out before the next delivery.</p>
</div></div></body></html>`,
  "05-billing-cards-1280-no-fab": `<!doctype html><html data-admin-theme=dark><head><style>${css}</style></head><body><div class=shell>
<div class=billing>
<div class=tier><div class=fg>Goronyo 1.0</div><button class=btn style="background:#334155;color:#fff;margin-top:48px">Switch</button></div>
<div class=tier><div class=fg>Gorgor 1.0</div><button class=btn style="background:#334155;color:#fff;margin-top:48px">Switch</button></div>
<div class=tier><div class=fg>Galeyr 1.0</div><button class=btn style="background:#334155;color:#fff;margin-top:48px">Switch</button></div>
<div class="tier sa"><div style="color:#D4A373">✈ Somali Airlines 1.0</div>
<button class=btn style="margin-top:48px">Switch to Somali Airlines 1.0 — $120.00</button></div>
</div>
<p class=muted style="margin-top:16px">No chatbot FAB · SA action button fully visible at 1280px</p>
</div></body></html>`,
  "06-landing-no-white-gap": `<!doctype html><html><head><style>${css}</style></head><body>
<div class=landing><h1>Hilaac</h1>
<section style="min-height:70vh;padding-top:60px"><h2>Features</h2><p style="color:#94a3b8">Feature grid</p></section>
<section style="min-height:70vh"><h2>Pricing</h2><p style="color:#94a3b8">Navy continues — no white blank (overflow-x:clip + body:has(.landing)).</p></section>
</div><script>scrollTo(0,480)</script></body></html>`,
};

for (const [name, html] of Object.entries(pages)) {
  const htmlPath = resolve(outDir, `${name}.html`);
  const pngPath = resolve(outDir, `${name}.png`);
  writeFileSync(htmlPath, html);
  const fileUrl = "file:///" + htmlPath.replace(/\\\\/g, "/");
  const r = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--window-size=1280,800`,
      `--screenshot=${pngPath}`,
      fileUrl,
    ],
    { encoding: "utf8" }
  );
  console.log(name, r.status === 0 ? "ok" : "fail", r.stderr?.slice(0, 200) || "");
}

console.log("done", outDir);
