/**
 * After `vercel env pull`, map alternate Supabase key names and ensure
 * payment secrets exist for local acceptance runs.
 */
import fs from "fs";
import crypto from "crypto";

const path = ".env.local";
let t = fs.readFileSync(path, "utf8");

function getRaw(k) {
  const line = t.split(/\r?\n/).find((l) => l.startsWith(`${k}=`));
  if (!line) return null;
  return line.slice(k.length + 1);
}

function unquote(v) {
  if (v == null) return "";
  let s = v;
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

function setKey(k, v) {
  const lines = t.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith(`${k}=`));
  const line = `${k}=${v}`;
  if (idx >= 0) lines[idx] = line;
  else lines.push(line);
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  t = lines.join("\n") + "\n";
}

const url =
  unquote(getRaw("NEXT_PUBLIC_SUPABASE_URL")) || unquote(getRaw("SUPABASE_URL"));
const anon =
  unquote(getRaw("NEXT_PUBLIC_SUPABASE_ANON_KEY")) ||
  unquote(getRaw("SUPABASE_ANON_KEY")) ||
  unquote(getRaw("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) ||
  unquote(getRaw("SUPABASE_PUBLISHABLE_KEY"));
const service =
  unquote(getRaw("SUPABASE_SERVICE_ROLE_KEY")) ||
  unquote(getRaw("SUPABASE_SECRET_KEY"));

if (url) setKey("NEXT_PUBLIC_SUPABASE_URL", url);
if (anon) setKey("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
if (service) setKey("SUPABASE_SERVICE_ROLE_KEY", service);

for (const k of [
  "CHARGE_TOKEN_SECRET",
  "EVC_WEBHOOK_SECRET",
  "EDAHAB_WEBHOOK_SECRET",
]) {
  if (!unquote(getRaw(k))) {
    setKey(k, crypto.randomBytes(32).toString("hex"));
  }
}

fs.writeFileSync(path, t);

console.log("url_len", unquote(getRaw("NEXT_PUBLIC_SUPABASE_URL")).length);
console.log("anon_len", unquote(getRaw("NEXT_PUBLIC_SUPABASE_ANON_KEY")).length);
console.log("service_len", unquote(getRaw("SUPABASE_SERVICE_ROLE_KEY")).length);
console.log("secret_key_len", unquote(getRaw("SUPABASE_SECRET_KEY")).length);
console.log("evc_wh_len", unquote(getRaw("EVC_WEBHOOK_SECRET")).length);
console.log("charge_len", unquote(getRaw("CHARGE_TOKEN_SECRET")).length);
console.log(
  "has_live_supabase",
  unquote(getRaw("NEXT_PUBLIC_SUPABASE_URL")).length > 0 &&
    unquote(getRaw("SUPABASE_SERVICE_ROLE_KEY")).length > 0
);
