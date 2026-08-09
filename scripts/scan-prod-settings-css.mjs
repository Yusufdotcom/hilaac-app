const u = "https://hilaacapp.so";
const html = await fetch(u).then((r) => r.text());
const chunks = [...html.matchAll(/\/_next\/static\/[^"'\\s]+\.js/g)].map((m) => m[0]);
console.log("chunk count", chunks.length);
const hits = [];
for (const p of chunks.slice(0, 40)) {
  try {
    const t = await fetch(u + p).then((r) => r.text());
    if (t.includes("Back to Admin")) hits.push({ p, hit: "Back to Admin" });
    if (t.includes("aspect-square") && t.includes("RadioGroup")) hits.push({ p, hit: "RadioGroup aspect-square" });
    if (t.includes("max-w-7xl flex-1")) hits.push({ p, hit: "max-w-7xl flex-1" });
    if (t.includes("overflow-x-hidden") && t.includes("admin-sidebar-width")) hits.push({ p, hit: "layout overflow-x-hidden" });
    if (t.includes("Never enter your own owner login") || t.includes("shared tablet")) hits.push({ p, hit: "staff banner" });
  } catch (e) {
    /* skip */
  }
}
console.log(JSON.stringify(hits, null, 2));
