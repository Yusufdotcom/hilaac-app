/**
 * Offline checks for recap dismiss key helpers (no @/ path imports).
 * Usage: node scripts/verify-recap-dismiss.mjs
 */

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

function appDayKey(now) {
  // Mirror APP_TIMEZONE Africa/Nairobi via fixed offset used in tests (+03:00).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function appWeekKey(now) {
  const day = appDayKey(now);
  const [year, month, date] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date, 12, 0, 0));
  const dow = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function recapDismissStorageKey(restaurantId, kind, periodKey) {
  return `hilaac-recap-dismissed:${restaurantId}:${kind}:${periodKey}`;
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
