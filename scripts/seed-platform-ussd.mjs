import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

function env(k, fallback = "") {
  let v = process.env[k] ?? fallback;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const encKey = env("ENCRYPTION_SECRET_KEY") || env("ENCRYPTION_KEY");
if (!encKey) {
  console.error("Missing ENCRYPTION_SECRET_KEY — set in .env.local to seed platform USSD");
  process.exit(1);
}
process.env.ENCRYPTION_SECRET_KEY = encKey;

const { createClient } = await import("@supabase/supabase-js");
const { encrypt } = await import("../lib/encryption.js");

const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
const key = env("SUPABASE_SERVICE_ROLE_KEY");
const evc = env("NEXT_PUBLIC_HILAAC_EVC_USSD", "*712*9*");
const edahab = env("NEXT_PUBLIC_HILAAC_EDAHAB_USSD", "*888*9*");

if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await admin.from("platform_settings").upsert({
  id: 1,
  evc_ussd_code_encrypted: encrypt(evc),
  edahab_ussd_code_encrypted: encrypt(edahab),
  updated_at: new Date().toISOString(),
});

if (error) {
  console.error("Seed failed:", error.message);
  process.exit(1);
}
console.log("Seeded platform USSD codes (encrypted)", { evc, edahab });
