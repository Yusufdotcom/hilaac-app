import { sortAlerts } from "../lib/alerts/types.ts";

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

const sorted = sortAlerts([
  {
    id: "n",
    severity: "normal",
    title: "n",
    description: "",
    whyItMatters: "",
    actionLabel: "",
    href: "/",
    rank: 99,
  },
  {
    id: "u",
    severity: "urgent",
    title: "u",
    description: "",
    whyItMatters: "",
    actionLabel: "",
    href: "/",
    rank: 1,
  },
  {
    id: "i",
    severity: "important",
    title: "i",
    description: "",
    whyItMatters: "",
    actionLabel: "",
    href: "/",
    rank: 50,
  },
]);

if (sorted.map((a) => a.id).join(",") === "u,i,n") pass("severity sort order");
else fail("severity sort", sorted.map((a) => a.id).join(","));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
