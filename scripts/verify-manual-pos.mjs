/**
 * Step 11 — Manual POS skip-accept + surface checks (offline).
 * Usage: node scripts/verify-manual-pos.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isAwaitingAcceptance } from "../lib/order/acceptance.ts";
import { isKitchenVisible } from "../lib/order/kitchen-visibility.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
function pass(n) {
  passed += 1;
  console.log("PASS ", n);
}
function fail(n) {
  failed += 1;
  console.log("FAIL ", n);
}

// POS order with accepted_at should not need Accept and should be kitchen-visible
const posOrder = {
  status: "new",
  accepted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};
if (!isAwaitingAcceptance(posOrder) && isKitchenVisible(posOrder)) {
  pass("POS auto-accepted → kitchen visible, not in Accept queue");
} else fail("POS auto-accept visibility");

// QR-style new order without accept still needs Accept
const qrOrder = { status: "new", accepted_at: null, created_at: new Date().toISOString() };
if (isAwaitingAcceptance(qrOrder) && !isKitchenVisible(qrOrder)) {
  pass("QR unaccepted → Accept queue, hidden from kitchen");
} else fail("QR accept gate");

const core = fs.readFileSync(path.join(__dirname, "../lib/order/create-order-core.ts"), "utf8");
if (core.includes("staffPos") && core.includes("accepted_at") && core.includes("created_by")) {
  pass("createOrderCore sets accepted_at + created_by for staffPos");
} else fail("createOrderCore missing POS fields");

const api = fs.readFileSync(path.join(__dirname, "../app/api/staff/orders/create/route.ts"), "utf8");
if (api.includes("skippedAccept") && api.includes("staffPos")) {
  pass("staff create API skips Accept");
} else fail("staff create API");

const board = fs.readFileSync(
  path.join(__dirname, "../components/admin/orders/admin-orders-board.tsx"),
  "utf8"
);
if (board.includes("New order") && board.includes("ManualPosDialog")) {
  pass("Admin Orders has New order");
} else fail("Admin Orders New order button");

const waiter = fs.readFileSync(
  path.join(__dirname, "../components/staff/waiter/waiter-board.tsx"),
  "utf8"
);
const cashier = fs.readFileSync(
  path.join(__dirname, "../components/staff/cashier/cashier-board.tsx"),
  "utf8"
);
if (waiter.includes("ManualPosDialog") && cashier.includes("ManualPosDialog")) {
  pass("Waiter + Cashier boards have POS");
} else fail("Staff POS entry points");

const mig = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/20250910220000_orders_created_by.sql"),
  "utf8"
);
if (mig.includes("created_by")) pass("Migration adds orders.created_by");
else fail("Migration missing");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
