import fs from "fs";
import crypto from "crypto";

const path = ".env.local";
let t = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const keys = ["CHARGE_TOKEN_SECRET", "EVC_WEBHOOK_SECRET", "EDAHAB_WEBHOOK_SECRET"];
const have = new Set(
  t
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => l.split("=")[0])
);

for (const k of keys) {
  if (!have.has(k)) {
    t += `${t.endsWith("\n") || t.length === 0 ? "" : "\n"}${k}=${crypto.randomBytes(32).toString("hex")}\n`;
  }
}
fs.writeFileSync(path, t);

function len(k) {
  const line = t.split(/\r?\n/).find((l) => l.startsWith(`${k}=`));
  if (!line) return -1;
  let v = line.slice(k.length + 1);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.trim().length;
}

console.log("url_len", len("NEXT_PUBLIC_SUPABASE_URL"));
console.log("service_len", len("SUPABASE_SERVICE_ROLE_KEY"));
console.log("evc_wh_len", len("EVC_WEBHOOK_SECRET"));
console.log("charge_len", len("CHARGE_TOKEN_SECRET"));
