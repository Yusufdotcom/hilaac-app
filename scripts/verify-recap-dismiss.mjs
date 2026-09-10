import { appDayKey, appWeekKey, recapDismissStorageKey } from "../lib/recap/recap-dismiss.ts";

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

const day = appDayKey(new Date("2026-09-10T12:00:00+03:00"));
if (day === "2026-09-10") pass("app day key");
else fail("app day key", day);

const week = appWeekKey(new Date("2026-09-10T12:00:00+03:00"));
if (/^2026-W\d{2}$/.test(week)) pass("app week key shape");
else fail("app week key", week);

const k = recapDismissStorageKey("rid", "daily", day);
if (k.includes("daily") && k.includes(day)) pass("storage key");
else fail("storage key", k);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
