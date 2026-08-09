const base = "https://hilaacapp.so";
const page = `${base}/order/baba-s-grill-and-cafe`;

const htmlRes = await fetch(page, { redirect: "follow" });
const html = await htmlRes.text();
console.log("page status", htmlRes.status, "final", htmlRes.url, "bytes", html.length);

const scripts = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]);
const unique = [...new Set(scripts)];
console.log("script tags", unique.length);

let draft = false;
let theme = false;
for (const path of unique) {
  const res = await fetch(base + path, { redirect: "follow" });
  const js = await res.text();
  if (js.includes("hilaac-order-draft")) {
    console.log("FOUND draft key in", path);
    draft = true;
  }
  if (js.includes("hilaac-order-theme")) {
    theme = true;
  }
}

console.log(
  JSON.stringify(
    {
      draftKeyDeployed: draft,
      themeKeyPresent: theme,
      note: draft
        ? "Draft persistence code is on production bundles"
        : "Draft key missing — Vercel may still be deploying 68a43d3",
    },
    null,
    2
  )
);
