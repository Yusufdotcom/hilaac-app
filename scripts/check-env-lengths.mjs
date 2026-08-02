import fs from "fs";

const file = process.argv[2] || ".env.local";
const t = fs.readFileSync(file, "utf8");
const keys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "CHARGE_TOKEN_SECRET",
  "EVC_WEBHOOK_SECRET",
  "EDAHAB_WEBHOOK_SECRET",
];

for (const k of keys) {
  const line = t.split(/\r?\n/).find((l) => l.startsWith(`${k}=`));
  if (!line) {
    console.log(`${k} MISSING`);
    continue;
  }
  let v = line.slice(k.length + 1);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  console.log(`${k} len=${v.trim().length}`);
}
