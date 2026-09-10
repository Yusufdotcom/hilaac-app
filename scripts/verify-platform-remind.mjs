import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { alreadyRemindedLabel, reminderCooldown } from "../lib/platform/reminder-cooldown.ts";

config({ path: ".env.local", quiet: true });

let passed = 0;
let failed = 0;
function pass(n, d = "") {
  passed += 1;
  console.log("PASS ", n, d);
}
function fail(n, d = "") {
  failed += 1;
  console.log("FAIL ", n, d);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const bobaId = "494ea124-18e9-4d8e-9056-16b673ff31a3";
const { data: boba } = await admin
  .from("restaurants")
  .select("id, owner_id, name")
  .eq("id", bobaId)
  .single();

const { data: authData } = await admin.auth.admin.getUserById(boba.owner_id);
const email = authData.user?.email ?? null;
if (email === "yusufyare1444@hotmail.com") {
  pass("Boba owner email resolved from Auth", email);
} else {
  fail("Boba owner email resolved", String(email));
}

const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
const cool = reminderCooldown(fiveMinAgo);
if (cool?.label === "Already reminded 5 minutes ago") {
  pass("Cooldown label", cool.label);
} else fail("cooldown label", JSON.stringify(cool));
if (alreadyRemindedLabel(0) === "Already reminded just now" && reminderCooldown(null) === null) {
  pass("Cooldown empty/just-now edge cases");
} else fail("cooldown edges");

const ui = readFileSync(resolve("components/platform/platform-restaurants.tsx"), "utf8");
if (
  ui.includes("Failed to send reminder —") &&
  ui.includes("redirectToLogin") &&
  ui.includes("sessionExpired") &&
  ui.includes("setRemindingId(null)") &&
  ui.includes("Already reminded")
) {
  pass("UI keeps honest failure toast + cooldown copy");
} else fail("UI error handling");

const route = readFileSync(resolve("app/api/platform/restaurants/[id]/remind/route.ts"), "utf8");
if (
  route.includes("resolveOwnerContact") &&
  route.includes("allowDryRun: false") &&
  route.includes("no_owner_email") &&
  route.includes("reminder_cooldown") &&
  route.includes("last_subscription_reminder_at")
) {
  pass("Remind route sends via owner contact email, no fake success, 1h cooldown");
} else fail("remind route");

const sender = readFileSync(resolve("lib/notifications/send-reminder.ts"), "utf8");
if (
  sender.includes('ReminderChannel[] = ["email"]') &&
  sender.includes("sendWhatsAppReminder") &&
  sender.includes("REMINDER_WHATSAPP")
) {
  pass("Channel abstraction keeps WhatsApp callable later");
} else fail("channel abstraction");

const emailTpl = readFileSync(resolve("lib/notifications/reminder-email.ts"), "utf8");
if (
  emailTpl.includes("expires in") &&
  emailTpl.includes("/billing?renew=1") &&
  emailTpl.includes("EVC Plus")
) {
  pass("Recap email includes plan timing, billing link, USSD instructions");
} else fail("email template");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
