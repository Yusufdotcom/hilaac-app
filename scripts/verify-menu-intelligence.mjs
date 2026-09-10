import {
  buildMenuIntelligence,
  classifyMenuItem,
  median,
  marginTrendFrom,
} from "../lib/menu/menu-intelligence.ts";

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

if (median([1, 3, 2]) === 2) pass("median odd");
else fail("median odd");
if (median([1, 2, 3, 4]) === 2.5) pass("median even");
else fail("median even");

if (classifyMenuItem({ unitsSold: 10, marginPct: 50, salesMedian: 5 }) === "stars")
  pass("stars");
else fail("stars");
if (classifyMenuItem({ unitsSold: 10, marginPct: 30, salesMedian: 5 }) === "sellers")
  pass("sellers");
else fail("sellers");
if (classifyMenuItem({ unitsSold: 2, marginPct: 55, salesMedian: 5 }) === "high_profit")
  pass("high_profit");
else fail("high_profit");
if (classifyMenuItem({ unitsSold: 2, marginPct: 20, salesMedian: 5 }) === "slow")
  pass("slow");
else fail("slow");

if (marginTrendFrom(40, 30) === "up") pass("trend up");
else fail("trend up");
if (marginTrendFrom(20, 30) === "down") pass("trend down");
else fail("trend down");
if (marginTrendFrom(30, 30.2) === "flat") pass("trend flat");
else fail("trend flat");

const result = buildMenuIntelligence({
  menuItems: [
    { id: "1", name: "Burger", price: 10, cost_price: 3 },
    { id: "2", name: "Salad", price: 8, cost_price: 5 },
    { id: "3", name: "NoCost", price: 5, cost_price: null },
  ],
  currentSales: [
    { item_name: "Burger", quantity_sold: 20, revenue: 200 },
    { item_name: "Salad", quantity_sold: 2, revenue: 16 },
  ],
  previousSales: [
    { item_name: "Burger", quantity_sold: 10, revenue: 100 },
    { item_name: "Salad", quantity_sold: 4, revenue: 32 },
  ],
});

if (result.hasCostPrices && result.items.length === 2) pass("excludes no-cost items");
else fail("excludes", JSON.stringify(result.items.map((i) => i.name)));

const burger = result.items.find((i) => i.name === "Burger");
if (burger && burger.classification === "stars" && burger.estProfit === 140)
  pass("burger stars profit");
else fail("burger", JSON.stringify(burger));

if (result.summary.mostOrdered?.name === "Burger") pass("most ordered");
else fail("most ordered");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
