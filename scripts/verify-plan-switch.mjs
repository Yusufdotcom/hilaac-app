/**
 * Unit checks for plan-switch renewal helpers + confirm date rules.
 */
import {
  freshSubscriptionEndDate,
  nextEndDateForConfirm,
  nextSubscriptionEndDate,
  parseRenewalIntent,
  renewalAmountForTier,
  resolveRenewalTier,
} from "../lib/platform/subscription-renewal.ts";
import { PLANS } from "../lib/constants.ts";

let passed = 0;
let failed = 0;
function pass(n) {
  passed += 1;
  console.log("PASS ", n);
}
function fail(n, d) {
  failed += 1;
  console.log("FAIL ", n, d ?? "");
}

// Intents
if (parseRenewalIntent("switch_starter") === "switch_starter") pass("parse switch_starter");
else fail("parse switch_starter");
if (parseRenewalIntent("upgrade_pro") === "upgrade_pro") pass("parse upgrade_pro");
else fail("parse upgrade_pro");
if (parseRenewalIntent("renew") === "renew") pass("parse renew");
else fail("parse renew");

// Tier resolution + prices
if (resolveRenewalTier("starter", "upgrade_pro") === "pro") pass("starter upgrade → pro");
else fail("starter upgrade → pro");
if (renewalAmountForTier("pro") === PLANS.pro.price && PLANS.pro.price === 79) {
  pass("pro price $79");
} else fail("pro price", String(renewalAmountForTier("pro")));

if (resolveRenewalTier("pro", "switch_starter") === "starter") pass("pro switch → starter");
else fail("pro switch → starter");
if (renewalAmountForTier("starter") === PLANS.starter.price && PLANS.starter.price === 29) {
  pass("starter price $29");
} else fail("starter price", String(renewalAmountForTier("starter")));

if (resolveRenewalTier("pro", "renew") === "pro") pass("pro renew stays pro");
else fail("pro renew stays pro");
if (resolveRenewalTier("starter", "renew") === "starter") pass("starter renew stays starter");
else fail("starter renew stays starter");
if (resolveRenewalTier("trial", "renew") === "starter") pass("trial renew → starter");
else fail("trial renew → starter");

// Date rules
const futureEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
const renewEnd = nextEndDateForConfirm({
  currentTier: "pro",
  renewalTier: "pro",
  currentEnd: futureEnd,
});
const expectedRenew = nextSubscriptionEndDate(futureEnd);
if (renewEnd === expectedRenew) pass("same-tier renew extends from remaining");
else fail("same-tier renew", `${renewEnd} vs ${expectedRenew}`);

const switchEnd = nextEndDateForConfirm({
  currentTier: "pro",
  renewalTier: "starter",
  currentEnd: futureEnd,
});
const fresh = freshSubscriptionEndDate();
const switchMs = new Date(switchEnd).getTime();
const freshMs = new Date(fresh).getTime();
if (Math.abs(switchMs - freshMs) < 2000) pass("pro→starter uses fresh 30d from now");
else fail("pro→starter fresh", `${switchEnd} vs ${fresh}`);

const upgradeEnd = nextEndDateForConfirm({
  currentTier: "starter",
  renewalTier: "pro",
  currentEnd: futureEnd,
});
if (Math.abs(new Date(upgradeEnd).getTime() - freshMs) < 5000) {
  pass("starter→pro uses fresh 30d from now");
} else fail("starter→pro fresh", upgradeEnd);

// UI expectations (string-level)
import { readFileSync } from "node:fs";
const billing = readFileSync("components/admin/billing/billing-view.tsx", "utf8");
if (billing.includes("Upgrade to Pro") && billing.includes("Switch to Starter")) {
  pass("billing cards expose Upgrade + Switch CTAs");
} else fail("billing CTAs missing");
if (billing.includes("DOWNGRADE_LOSSES") || billing.includes("AI menu image generator")) {
  pass("downgrade warning lists Pro feature loss");
} else fail("downgrade warning");
if (billing.includes("switch_starter")) pass("billing posts switch_starter intent");
else fail("switch_starter intent wiring");

const confirm = readFileSync("app/api/platform/renewals/[id]/confirm/route.ts", "utf8");
if (
  confirm.includes("nextEndDateForConfirm") &&
  confirm.includes('payment_mode = "ussd"') &&
  confirm.includes('tier === "starter"')
) {
  pass("confirm uses switch date rule + ussd on downgrade");
} else fail("confirm route incomplete");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
