/**
 * Unit checks for plan-switch renewal helpers + confirm date rules.
 */
import {
  billingCardForTier,
  freshSubscriptionEndDate,
  intentForBillingCard,
  nextEndDateForConfirm,
  nextSubscriptionEndDate,
  parseRenewalIntent,
  renewalAmountForTier,
  resolveRenewalTier,
  shouldForceUssdOnTier,
} from "../lib/platform/subscription-renewal.ts";
import { PLANS } from "../lib/constants.ts";
import { readFileSync } from "node:fs";

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

if (parseRenewalIntent("switch_goronyo") === "switch_goronyo") pass("parse switch_goronyo");
else fail("parse switch_goronyo");
if (parseRenewalIntent("switch_gorgor") === "switch_gorgor") pass("parse switch_gorgor");
else fail("parse switch_gorgor");
if (parseRenewalIntent("switch_galeyr") === "switch_galeyr") pass("parse switch_galeyr");
else fail("parse switch_galeyr");
if (parseRenewalIntent("renew") === "renew") pass("parse renew");
else fail("parse renew");

// Legacy intents still work
if (resolveRenewalTier("starter", "upgrade_pro") === "pro") pass("legacy starter upgrade → pro");
else fail("legacy starter upgrade → pro");
if (resolveRenewalTier("pro", "switch_starter") === "starter") pass("legacy pro switch → starter");
else fail("legacy pro switch → starter");

// New model
if (resolveRenewalTier("pro", "renew") === "pro") pass("pro renew stays pro until Step 1.7");
else fail("pro renew");
if (resolveRenewalTier("trial", "renew") === "goronyo") pass("trial renew → goronyo");
else fail("trial renew → goronyo");
if (resolveRenewalTier("gorgor", "switch_galeyr") === "galeyr") pass("gorgor → galeyr");
else fail("gorgor → galeyr");
if (renewalAmountForTier("goronyo") === 15) pass("goronyo $15");
else fail("goronyo price");
if (renewalAmountForTier("gorgor") === 30) pass("gorgor $30");
else fail("gorgor price");
if (renewalAmountForTier("galeyr") === 60) pass("galeyr $60");
else fail("galeyr price");

if (billingCardForTier("pro") === "galeyr") pass("pro maps to Galeyr billing card");
else fail("pro billing card");
if (billingCardForTier("starter") === "goronyo") pass("starter maps to Goronyo billing card");
else fail("starter billing card");
if (intentForBillingCard("pro", "goronyo") === "switch_goronyo") pass("pro→goronyo intent");
else fail("pro→goronyo intent");
if (intentForBillingCard("pro", "galeyr") === "renew") pass("pro on Galeyr card renews as pro");
else fail("pro galeyr renew");

if (shouldForceUssdOnTier("goronyo") && !shouldForceUssdOnTier("gorgor")) {
  pass("USSD forced on goronyo only among new paid tiers");
} else fail("ussd force");

const futureEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
const renewEnd = nextEndDateForConfirm({
  currentTier: "pro",
  renewalTier: "pro",
  currentEnd: futureEnd,
});
if (renewEnd === nextSubscriptionEndDate(futureEnd)) pass("same-tier renew extends");
else fail("same-tier renew");

const switchEnd = nextEndDateForConfirm({
  currentTier: "pro",
  renewalTier: "goronyo",
  currentEnd: futureEnd,
});
const fresh = freshSubscriptionEndDate();
if (Math.abs(new Date(switchEnd).getTime() - new Date(fresh).getTime()) < 2000) {
  pass("pro→goronyo uses fresh 30d");
} else fail("pro→goronyo fresh");

const billing = readFileSync("components/admin/billing/billing-view.tsx", "utf8");
if (billing.includes("goronyo") && billing.includes("gorgor") && billing.includes("galeyr")) {
  pass("billing shows three new plan cards");
} else fail("billing cards");
if (billing.includes("switch_goronyo") || billing.includes("intentForBillingCard")) {
  pass("billing wires new switch intents");
} else fail("billing intents");

const confirm = readFileSync("app/api/platform/renewals/[id]/confirm/route.ts", "utf8");
if (confirm.includes("shouldForceUssdOnTier") && confirm.includes("isBillableTier")) {
  pass("confirm accepts new tiers + USSD force helper");
} else fail("confirm route");

if (PLANS.goronyo.name === "Goronyo 1.0" && PLANS.gorgor.price === 30 && PLANS.galeyr.price === 60) {
  pass("PLANS metadata for new tiers");
} else fail("PLANS metadata");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
