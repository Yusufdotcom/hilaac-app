/**
 * Step 10 — chatbot gate + tool surface (no live LLM call).
 * Usage: node scripts/verify-chatbot-gate.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { canUseFeature } from "../lib/billing/tier-capabilities.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
function pass(n) {
  passed += 1;
  console.log("PASS ", n);
}
function fail(n) {
  failed += 1;
  console.log("FAIL ", n);
}

if (!canUseFeature("goronyo", "ai_chatbot") && !canUseFeature("gorgor", "ai_chatbot")) {
  pass("Goronyo/Gorgor cannot use ai_chatbot");
} else fail("lower tiers must not get ai_chatbot");

if (
  canUseFeature("galeyr", "ai_chatbot") &&
  canUseFeature("pro", "ai_chatbot") &&
  canUseFeature("trial", "ai_chatbot")
) {
  pass("Galeyr + legacy pro/trial can use ai_chatbot");
} else fail("Galeyr/pro/trial should get ai_chatbot");

const expectedTools = [
  "getKPISummary",
  "getRevenueTrend",
  "getTopItems",
  "getPeakHours",
  "getPaymentSplit",
  "getMenuProfitability",
  "getInventorySummary",
  "getExpensesPnL",
  "getStaffPerformance",
  "getCustomerIntelligence",
];

const toolsSrc = fs.readFileSync(path.join(__dirname, "../lib/chatbot/build-tools.ts"), "utf8");
for (const name of expectedTools) {
  if (toolsSrc.includes(`${name}: tool(`)) pass(`tool defined: ${name}`);
  else fail(`missing tool: ${name}`);
}

const routeSrc = fs.readFileSync(path.join(__dirname, "../app/api/admin/chatbot/route.ts"), "utf8");
if (routeSrc.includes("canUseFeature") && routeSrc.includes('"ai_chatbot"') && routeSrc.includes("tier_gated")) {
  pass("API hard-gates ai_chatbot");
} else fail("API missing hard gate");

if (routeSrc.includes("buildChatbotTools") && routeSrc.includes("stopWhen")) {
  pass("API uses RPC tools + multi-step stopWhen");
} else fail("API missing tool loop");

const uiSrc = fs.readFileSync(
  path.join(__dirname, "../components/admin/chatbot/business-chatbot.tsx"),
  "utf8"
);
if (uiSrc.includes("Galeyr 1.0 exclusive")) pass("UI shows Galeyr exclusive when gated");
else fail("UI missing exclusive message");

const shellSrc = fs.readFileSync(
  path.join(__dirname, "../components/admin/admin-layout-shell.tsx"),
  "utf8"
);
if (shellSrc.includes("BusinessChatbot") && shellSrc.includes("ai_chatbot")) {
  pass("Chatbot mounted in admin shell");
} else fail("Chatbot not mounted in admin shell");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
