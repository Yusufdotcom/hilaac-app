import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

function env(k) {
  let v = process.env[k] ?? "";
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const { normalizeLoyaltyPhone } = await import("../lib/loyalty/phone.ts");
const { mintOrderAccessToken } = await import("../lib/payments/charge-token.ts");
const { createClient } = await import("@supabase/supabase-js");

const orderId = "cd6a4e15-4a0e-491b-8c63-306da3414057";
const phone = "0666666666";

process.env.CHARGE_TOKEN_SECRET = env("CHARGE_TOKEN_SECRET");

const storedRaw = "0666666666";
console.log("DB customer_phone (from earlier query):", JSON.stringify(storedRaw));
console.log("normalize(stored):", normalizeLoyaltyPhone(storedRaw));
console.log("normalize(submitted):", normalizeLoyaltyPhone(phone));
console.log(
  "phones equal after normalize:",
  normalizeLoyaltyPhone(storedRaw) === normalizeLoyaltyPhone(phone)
);
console.log("CHARGE_TOKEN_SECRET length:", env("CHARGE_TOKEN_SECRET").length);

try {
  const t = mintOrderAccessToken(orderId, "16681f63-f393-4645-8641-bd4437d8a744");
  console.log("local mint: OK parts=", t.split(".").length);
} catch (e) {
  console.log("local mint: FAIL", e instanceof Error ? e.message : e);
}

const bases = [
  env("TRACK_VERIFY_BASE_URL") || "http://localhost:3000",
  "https://hilaacapp.so",
];

for (const base of bases) {
  const url = `${base.replace(/\/$/, "")}/api/orders/${orderId}/recover-access`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const body = await res.json().catch(() => ({}));
    console.log(`\nPOST ${url}`);
    console.log("  status:", res.status);
    console.log("  body:", JSON.stringify(body));
  } catch (e) {
    console.log(`\nPOST ${url}`);
    console.log("  network error:", e instanceof Error ? e.message : e);
  }
}

// Confirm DB phone again via service role
const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
const service = env("SUPABASE_SERVICE_ROLE_KEY");
if (url && service) {
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("orders")
    .select("id, order_number, customer_phone")
    .eq("id", orderId)
    .maybeSingle();
  console.log("\nDB re-read:", data, error?.message ?? "");
}
