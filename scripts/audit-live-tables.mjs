import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !service || !anonKey) {
  console.error("Missing env");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const tables = [
  "loyalty_settings",
  "loyalty_progress",
  "loyalty_redemptions",
  "whatsapp_contacts",
  "whatsapp_settings",
];

for (const t of tables) {
  const { error, count } = await admin.from(t).select("*", { count: "exact", head: true });
  console.log(t, error ? `FAIL ${error.message}` : `OK count=${count}`);
}

const r = await anon.rpc("create_demo_restaurant");
console.log(
  "N4 anon create_demo_restaurant",
  r.error ? `BLOCKED: ${r.error.message}` : `OPEN: ${r.data}`
);

// Probe N3: does trigger function exist? service can update own profile as service (uid null) so skip.
// Probe N2: has_column_privilege not available via REST — note UNKNOWN for live apply.

console.log("APP_URL env set:", Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()));
console.log("WHATSAPP_DRY_RUN:", process.env.WHATSAPP_DRY_RUN ?? "(unset→default true)");
console.log("DEMO_CREATE_ENABLED:", process.env.DEMO_CREATE_ENABLED ?? "(unset)");
console.log(
  "ALLOW_MANUAL_SUBSCRIPTION_CONFIRM:",
  process.env.ALLOW_MANUAL_SUBSCRIPTION_CONFIRM ?? "(unset)"
);
