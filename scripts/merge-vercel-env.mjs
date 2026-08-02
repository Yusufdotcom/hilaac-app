/**
 * Merge a vercel env pull file into .env.local, mapping alternate Supabase
 * key names and preserving/restoring payment secrets.
 */
import fs from "fs";
import crypto from "crypto";

const src = process.argv[2] || ".env.vercel.prod";
const dest = ".env.local";

function parse(file) {
  const m = new Map();
  if (!fs.existsSync(file)) return m;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let k = t.slice(0, i);
    let v = t.slice(i + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    m.set(k, v.trim());
  }
  return m;
}

const pulled = parse(src);
const local = parse(dest);

for (const [k, v] of pulled) {
  if (v) local.set(k, v);
}

const url = local.get("NEXT_PUBLIC_SUPABASE_URL") || local.get("SUPABASE_URL") || "";
const anon =
  local.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
  local.get("SUPABASE_ANON_KEY") ||
  local.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
  local.get("SUPABASE_PUBLISHABLE_KEY") ||
  "";
const service =
  local.get("SUPABASE_SERVICE_ROLE_KEY") || local.get("SUPABASE_SECRET_KEY") || "";

if (url) local.set("NEXT_PUBLIC_SUPABASE_URL", url);
if (anon) local.set("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
if (service) local.set("SUPABASE_SERVICE_ROLE_KEY", service);

for (const k of [
  "CHARGE_TOKEN_SECRET",
  "EVC_WEBHOOK_SECRET",
  "EDAHAB_WEBHOOK_SECRET",
]) {
  if (!local.get(k)) {
    local.set(k, crypto.randomBytes(32).toString("hex"));
  }
}

const lines = [...local.entries()].map(([k, v]) => `${k}=${v}`);
fs.writeFileSync(dest, lines.join("\n") + "\n");

console.log("merged", src, "→", dest);
console.log("url_len", (local.get("NEXT_PUBLIC_SUPABASE_URL") || "").length);
console.log("anon_len", (local.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "").length);
console.log("service_len", (local.get("SUPABASE_SERVICE_ROLE_KEY") || "").length);
console.log("secret_key_len", (local.get("SUPABASE_SECRET_KEY") || "").length);
console.log(
  "has_live_supabase",
  Boolean(local.get("NEXT_PUBLIC_SUPABASE_URL") && local.get("SUPABASE_SERVICE_ROLE_KEY"))
);
