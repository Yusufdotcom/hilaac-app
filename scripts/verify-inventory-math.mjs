import {
  daysRemaining,
  inventoryKpis,
  inventoryStatus,
  recommendedOrderQty,
  enrichInventoryItem,
  parseWasteFromExpense,
} from "../lib/inventory/inventory-math.ts";

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

if (inventoryStatus({ current_stock: 0, reorder_level: 5 }) === "out") pass("out");
else fail("out");
if (inventoryStatus({ current_stock: 3, reorder_level: 5 }) === "reorder") pass("reorder");
else fail("reorder");
if (inventoryStatus({ current_stock: 10, reorder_level: 5 }) === "good") pass("good");
else fail("good");

if (daysRemaining(20, 4) === 5) pass("days remaining");
else fail("days remaining", String(daysRemaining(20, 4)));
if (daysRemaining(20, 0) === null) pass("days remaining null");
else fail("days remaining null");

// (daily_usage × delivery_days) + reorder_level - current_stock
const rec = recommendedOrderQty({
  current_stock: 2,
  daily_usage_estimate: 3,
  reorder_level: 5,
  supplier_delivery_days: 2,
});
if (rec === 9) pass("recommended order");
else fail("recommended order", String(rec));

const row = enrichInventoryItem({
  id: "1",
  restaurant_id: "r",
  name: "Rice",
  unit: "kg",
  current_stock: 0,
  daily_usage_estimate: 2,
  reorder_level: 5,
  supplier_delivery_days: 2,
  cost_per_unit: 1,
  updated_at: new Date().toISOString(),
});
const kpis = inventoryKpis([row]);
if (kpis.outOfStock === 1) pass("kpi out");
else fail("kpi out");

const waste = parseWasteFromExpense({
  id: "e1",
  amount: 12,
  date: "2026-09-10",
  note: "Waste: Tomatoes — spoiled",
});
if (waste?.productName === "Tomatoes — spoiled" || waste?.productName.startsWith("Tomatoes"))
  pass("waste parse");
else fail("waste parse", JSON.stringify(waste));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
