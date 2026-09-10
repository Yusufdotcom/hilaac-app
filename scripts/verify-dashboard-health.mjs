/**
 * Unit checks for dashboard business health scoring.
 */
import { computeBusinessHealth } from "../lib/dashboard/business-health.ts";
import {
  formatTodayLabel,
  getTimeOfDayGreeting,
  greetingDisplayName,
} from "../lib/time/greeting.ts";

let passed = 0;
let failed = 0;
function pass(n) {
  passed += 1;
  console.log("PASS ", n);
}
function fail(n, d = "") {
  failed += 1;
  console.log("FAIL ", n, d);
}

const healthy = computeBusinessHealth({
  revenueDeltaPct: 20,
  ordersDeltaPct: 10,
  awaitingPaymentConfirmation: 0,
  revenueAvailable: true,
  ordersAvailable: true,
  backlogAvailable: true,
});
if (healthy.score >= 70 && healthy.status === "HEALTHY") pass("healthy score");
else fail("healthy score", JSON.stringify(healthy));

const critical = computeBusinessHealth({
  revenueDeltaPct: -80,
  ordersDeltaPct: -50,
  awaitingPaymentConfirmation: 8,
  revenueAvailable: true,
  ordersAvailable: true,
  backlogAvailable: true,
});
if (critical.score < 40 && critical.status === "CRITICAL") pass("critical score");
else fail("critical score", JSON.stringify(critical));

const partial = computeBusinessHealth({
  revenueDeltaPct: null,
  ordersDeltaPct: null,
  awaitingPaymentConfirmation: 0,
  revenueAvailable: false,
  ordersAvailable: false,
  backlogAvailable: true,
});
if (partial.parts.backlogPts === 30 && partial.score === 100) pass("partial backlog-only score");
else fail("partial", JSON.stringify(partial));
if (partial.explanation.toLowerCase().includes("could load")) pass("partial explanation");
else fail("partial explanation", partial.explanation);

if (greetingDisplayName("Safary Ali") === "Safary") pass("greeting first name");
else fail("greeting first name");
if (greetingDisplayName(null) === "there") pass("greeting fallback");
else fail("greeting fallback");

const g = getTimeOfDayGreeting(new Date("2026-09-10T08:00:00+03:00"));
if (g === "Good morning") pass("morning greeting EAT");
else fail("morning greeting", g);

if (formatTodayLabel(new Date("2026-09-10T12:00:00+03:00")).startsWith("Today,")) {
  pass("today label");
} else fail("today label");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
