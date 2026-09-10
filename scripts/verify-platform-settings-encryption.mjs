/**
 * Round-trip: encrypt → upsert platform_settings → decrypt → assert match.
 * Also asserts ciphertext is not plaintext.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const { createClient } = await import("@supabase/supabase-js");
const { encrypt, decrypt } = await import("../lib/encryption.js");

if (!process.env.ENCRYPTION_SECRET_KEY?.trim()) {
  console.error("FAIL ENCRYPTION_SECRET_KEY missing");
  process.exit(1);
}

const evc = "*712*9*";
const edahab = "*888*9*";
const encEvc = encrypt(evc);
const encEdahab = encrypt(edahab);

if (!encEvc || !encEdahab) {
  console.error("FAIL encrypt returned null");
  process.exit(1);
}
if (encEvc.includes(evc) || encEdahab.includes(edahab)) {
  console.error("FAIL ciphertext contains plaintext");
  process.exit(1);
}
if (decrypt(encEvc) !== evc || decrypt(encEdahab) !== edahab) {
  console.error("FAIL local decrypt mismatch");
  process.exit(1);
}
console.log("PASS local encrypt/decrypt");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, { auth: { persistSession: false } });

const { error: upErr } = await admin.from("platform_settings").upsert({
  id: 1,
  evc_ussd_code_encrypted: encEvc,
  edahab_ussd_code_encrypted: encEdahab,
  updated_at: new Date().toISOString(),
});
if (upErr) {
  console.error("FAIL upsert", upErr.message);
  process.exit(1);
}
console.log("PASS upsert encrypted codes");

const { data, error } = await admin
  .from("platform_settings")
  .select("evc_ussd_code_encrypted, edahab_ussd_code_encrypted")
  .eq("id", 1)
  .single();
if (error) {
  console.error("FAIL reload", error.message);
  process.exit(1);
}

const gotEvc = decrypt(data.evc_ussd_code_encrypted);
const gotEdahab = decrypt(data.edahab_ussd_code_encrypted);
if (gotEvc !== evc || gotEdahab !== edahab) {
  console.error("FAIL reload decrypt", { gotEvc, gotEdahab });
  process.exit(1);
}
if (
  String(data.evc_ussd_code_encrypted).includes("*712*") ||
  String(data.edahab_ussd_code_encrypted).includes("*888*")
) {
  console.error("FAIL DB still has plaintext-looking codes");
  process.exit(1);
}

console.log("PASS reload decrypt matches", { evc: gotEvc, edahab: gotEdahab });
console.log("PASS ciphertext stored (not plaintext)");
console.log("\nAll platform settings encryption checks passed");
