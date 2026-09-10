/**
 * Smoke-test tier capability mapping (offline).
 * Usage: node scripts/verify-tier-capabilities.mjs
 */
import {
  canUseFeature,
  capabilitiesForTier,
  tierDisplayName,
} from "../lib/billing/tier-capabilities.ts";

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

// Legacy: starter = Goronyo
if (canUseFeature("starter", "basic_reports") && !canUseFeature("starter", "ai_menu_images")) {
  pass("starter → Goronyo (basic yes, AI no)");
} else fail("starter → Goronyo");

// Legacy: pro = Galeyr (keeps everything)
if (
  canUseFeature("pro", "ai_chatbot") &&
  canUseFeature("pro", "ai_menu_images") &&
  canUseFeature("pro", "multi_branch")
) {
  pass("pro → Galeyr (chatbot + AI + branches)");
} else fail("pro → Galeyr");

// Trial stays full access
if (canUseFeature("trial", "ai_chatbot") && canUseFeature("trial", "advanced_reports")) {
  pass("trial → Galeyr capabilities");
} else fail("trial → Galeyr");

// New tiers
if (!canUseFeature("goronyo", "recap_email") && canUseFeature("gorgor", "recap_email")) {
  pass("recap_email: goronyo no / gorgor yes");
} else fail("recap_email gate");

if (!canUseFeature("gorgor", "ai_chatbot") && canUseFeature("galeyr", "ai_chatbot")) {
  pass("ai_chatbot: gorgor no / galeyr yes");
} else fail("ai_chatbot exclusive");

// Fail open
const unknown = capabilitiesForTier("mystery_plan");
if (unknown.ai_chatbot === true) pass("unknown tier fails OPEN to Galeyr");
else fail("unknown tier fail-open");

if (tierDisplayName("goronyo") === "Goronyo 1.0") pass("display name Goronyo");
else fail("display name");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
