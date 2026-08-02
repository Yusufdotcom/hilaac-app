/**
 * Verify C2: encrypted merchant columns are not SELECT-able by anon;
 * service_role can still read them.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

function envVal(k) {
  let v = process.env[k] ?? "";
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const url = envVal("NEXT_PUBLIC_SUPABASE_URL") || envVal("SUPABASE_URL");
const service = envVal("SUPABASE_SERVICE_ROLE_KEY");
const anon = envVal("NEXT_PUBLIC_SUPABASE_ANON_KEY") || envVal("SUPABASE_ANON_KEY");

if (!url || !service || !anon) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cols =
  "id, evc_merchant_id_encrypted, evc_api_key_encrypted, edahab_merchant_id_encrypted, edahab_api_key_encrypted";

let passed = 0;
let failed = 0;
function pass(n, d = "") {
  passed += 1;
  console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  failed += 1;
  console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
}

{
  const { data, error } = await admin.from("restaurants").select(cols).limit(1);
  if (!error) pass("service_role SELECT encrypted columns", `rows=${data?.length ?? 0}`);
  else fail("service_role SELECT encrypted columns", error.message);
}

{
  const { data, error } = await anonClient.from("restaurants").select(cols).limit(1);
  if (error) {
    pass("anon SELECT encrypted columns blocked", error.message);
  } else if (
    data?.some(
      (r) =>
        r.evc_api_key_encrypted != null ||
        r.evc_merchant_id_encrypted != null ||
        r.edahab_api_key_encrypted != null ||
        r.edahab_merchant_id_encrypted != null
    )
  ) {
    fail("anon SELECT encrypted columns blocked", "ciphertext returned");
  } else if (data?.some((r) => "evc_api_key_encrypted" in r)) {
    fail("anon SELECT encrypted columns blocked", "columns present without error");
  } else {
    pass("anon SELECT encrypted columns blocked", "columns not returned");
  }
}

// Privilege catalog via service-role SQL endpoint is unavailable; use REST open check:
// authenticated inherits same column grants as anon for public SELECT columns, and
// encrypted SELECT was only granted to authenticated — after REVOKE both should fail.
{
  const { error } = await anonClient
    .from("restaurants")
    .select("evc_api_key_encrypted")
    .limit(1);
  if (error) pass("anon explicit encrypted column query blocked", error.message);
  else fail("anon explicit encrypted column query blocked", "no error");
}

console.log(`\nC2 grants: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
