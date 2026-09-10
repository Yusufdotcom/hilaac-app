import {
  assignCustomerSegment,
  bucketRatings,
  countSegments,
  returningSalesShare,
} from "../lib/customers/customer-segments.ts";

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

const now = new Date("2026-09-10T12:00:00+03:00");

if (
  assignCustomerSegment(
    {
      total_visits: 12,
      lifetime_spend: 50,
      last_visit: "2026-09-09T12:00:00+03:00",
      first_visit: "2025-01-01T12:00:00+03:00",
      visits_last_30d: 2,
    },
    now
  ) === "vip"
)
  pass("vip by visits");
else fail("vip");

if (
  assignCustomerSegment(
    {
      total_visits: 5,
      lifetime_spend: 20,
      last_visit: "2026-07-01T12:00:00+03:00",
      first_visit: "2025-01-01T12:00:00+03:00",
      visits_last_30d: 0,
    },
    now
  ) === "at_risk"
)
  pass("at_risk");
else fail("at_risk");

if (
  assignCustomerSegment(
    {
      total_visits: 1,
      lifetime_spend: 10,
      last_visit: "2026-09-08T12:00:00+03:00",
      first_visit: "2026-09-08T12:00:00+03:00",
      visits_last_30d: 1,
    },
    now
  ) === "new"
)
  pass("new");
else fail("new");

if (
  assignCustomerSegment(
    {
      total_visits: 4,
      lifetime_spend: 40,
      last_visit: "2026-09-05T12:00:00+03:00",
      first_visit: "2026-01-01T12:00:00+03:00",
      visits_last_30d: 4,
    },
    now
  ) === "regular"
)
  pass("regular");
else fail("regular");

const fb = bucketRatings([5, 4, 3, 1, 2]);
if (fb.positive === 2 && fb.neutral === 1 && fb.negative === 2) pass("feedback buckets");
else fail("feedback", JSON.stringify(fb));

if (returningSalesShare(40, 100) === 40) pass("returning share");
else fail("returning share");

const counts = countSegments(
  [
    {
      total_visits: 12,
      lifetime_spend: 0,
      last_visit: "2026-09-09T12:00:00+03:00",
      first_visit: "2025-01-01T12:00:00+03:00",
      visits_last_30d: 1,
    },
  ],
  now
);
if (counts.vip === 1) pass("count vip");
else fail("count");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
