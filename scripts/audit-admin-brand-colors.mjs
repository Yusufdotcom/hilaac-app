/**
 * Exhaustive scan of admin UI for hardcoded accent colors that may need brand tokens.
 * Classifies semantic (keep) vs brand candidates (fix).
 */
import fs from "node:fs";
import path from "node:path";

const roots = [
  path.join(process.cwd(), "app", "admin"),
  path.join(process.cwd(), "components", "admin"),
];

const patterns = [
  { re: /#D4A373|#d4a373/g, tag: "hilaac-gold-hex" },
  { re: /hilaac-gold/g, tag: "hilaac-gold-class" },
  { re: /text-primary\b/g, tag: "text-primary" },
  { re: /bg-primary\b/g, tag: "bg-primary" },
  { re: /border-primary\b/g, tag: "border-primary" },
  { re: /text-amber-[0-9]+/g, tag: "text-amber" },
  { re: /bg-amber-[0-9]+/g, tag: "bg-amber" },
  { re: /border-amber-[0-9]+/g, tag: "border-amber" },
  { re: /text-orange-[0-9]+/g, tag: "text-orange" },
  { re: /bg-orange-[0-9]+/g, tag: "bg-orange" },
  { re: /border-orange-[0-9]+/g, tag: "border-orange" },
  { re: /adminBrand|var\(--admin-brand|--brand-accent/g, tag: "uses-brand-token" },
];

const SEMANTIC_HINTS =
  /pending_cashier|awaiting_payment|preparing|cancelled|destructive|warning|trial|opt.?out|dry-run|underperforming|PAYMENT_COLORS|eDahab|status|badge|Confirm payment|void|emerald|red-|green-/i;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const files = roots.flatMap((r) => walk(r));
const findings = [];

for (const file of files) {
  const rel = path.relative(process.cwd(), file).replaceAll("\\", "/");
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const { re, tag } of patterns) {
      re.lastIndex = 0;
      if (!re.test(line)) continue;
      if (tag === "uses-brand-token") continue;
      const semantic = SEMANTIC_HINTS.test(line) || SEMANTIC_HINTS.test(lines.slice(Math.max(0, i - 3), i + 2).join("\n"));
      findings.push({
        file: rel,
        line: i + 1,
        tag,
        semantic,
        snippet: line.trim().slice(0, 160),
      });
    }
  });
}

const brandCandidates = findings.filter((f) => !f.semantic);
const semanticKeep = findings.filter((f) => f.semantic);

const byPage = {};
for (const f of brandCandidates) {
  const page =
    f.file.includes("/dashboard")
      ? "Dashboard"
      : f.file.includes("/menu") || f.file.includes("menu/")
        ? "Menu"
        : f.file.includes("table")
          ? "Tables"
          : f.file.includes("order")
            ? "Orders"
            : f.file.includes("report")
              ? "Reports"
              : f.file.includes("staff")
                ? "Staff"
                : f.file.includes("settings")
                  ? "Settings"
                  : f.file.includes("billing")
                    ? "Billing"
                    : f.file.includes("admin-layout") || f.file.includes("admin-sidebar") || f.file.includes("admin-user")
                      ? "Shell/Nav"
                      : "Other admin";
  (byPage[page] ??= []).push(f);
}

const out = {
  scannedFiles: files.length,
  brandCandidates: brandCandidates.length,
  semanticKeep: semanticKeep.length,
  byPage,
  brandCandidatesList: brandCandidates,
  semanticKeepList: semanticKeep,
};

const outDir = path.join(process.cwd(), "tmp", "admin-design-evidence");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "admin-color-audit.json"), JSON.stringify(out, null, 2));

console.log(`Scanned ${files.length} files`);
console.log(`Brand candidates (non-semantic): ${brandCandidates.length}`);
console.log(`Semantic keep: ${semanticKeep.length}`);
console.log("\nBy page:");
for (const [page, items] of Object.entries(byPage)) {
  console.log(`\n## ${page} (${items.length})`);
  for (const f of items) {
    console.log(`  ${f.file}:${f.line} [${f.tag}] ${f.snippet}`);
  }
}
