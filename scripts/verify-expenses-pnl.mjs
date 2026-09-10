import {
  biggestCategoryIncrease,
  buildMargins,
  buildWaterfall,
  expenseDeltaPct,
  operatingFromCategories,
  pctOf,
  sumByCategory,
} from "../lib/expenses/pnl-math.ts";

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

const w = buildWaterfall({ revenue: 1000, cogs: 300, labor: 200, operating: 150 });
if (w.estProfit === 350) pass("est profit");
else fail("est profit", String(w.estProfit));

const m = buildMargins(w);
if (m.grossMarginPct === 70 && m.foodCostPct === 30 && m.laborPct === 20) pass("margins");
else fail("margins", JSON.stringify(m));

if (pctOf(250, 1000) === 25) pass("pctOf");
else fail("pctOf");

if (expenseDeltaPct(120, 100) === 20) pass("delta up");
else fail("delta up");
if (expenseDeltaPct(80, 100) === -20) pass("delta down");
else fail("delta down");

const by = sumByCategory([
  { category: "rent", amount: 100 },
  { category: "labor", amount: 50 },
  { category: "rent", amount: 20 },
]);
if (by.rent === 120 && by.labor === 50) pass("sumByCategory");
else fail("sumByCategory", JSON.stringify(by));

if (operatingFromCategories({ rent: 100, utilities: 40, supplies: 10, other: 5, labor: 999 }) === 155)
  pass("operating excludes labor");
else fail("operating");

const big = biggestCategoryIncrease(
  { rent: 200, labor: 50 },
  { rent: 100, labor: 40 }
);
if (big?.category === "rent" && big.delta === 100) pass("biggest increase");
else fail("biggest", JSON.stringify(big));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
