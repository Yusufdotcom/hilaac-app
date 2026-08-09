/**
 * Source guard: cart must not POST /api/orders/create on the pending handoff path;
 * status fulfill uses a module lock; temp ids are pending-* prefixed.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function pass(n) {
  console.log("PASS ", n);
}
function fail(n, d) {
  console.error("FAIL ", n, d ?? "");
  process.exitCode = 1;
}

const cart = readFileSync(resolve("components/order/cart-sheet.tsx"), "utf8");
const handoff = readFileSync(resolve("lib/order/pending-order-handoff.ts"), "utf8");
const status = readFileSync(resolve("app/order/[slug]/status/page.tsx"), "utf8");

if (cart.includes("Sole create path is the Status page")) {
  pass("cart documents status-only create for handoff path");
} else {
  fail("cart missing sole-create comment");
}

// After handoff save, cart should not call createOrder in that branch.
const handoffIdx = cart.indexOf("savePendingOrderHandoff({");
const afterHandoff = cart.slice(handoffIdx, handoffIdx + 800);
if (afterHandoff.includes("createOrder(")) {
  fail("cart still calls createOrder after savePendingOrderHandoff");
} else {
  pass("cart does not createOrder after pending handoff");
}

if (handoff.includes("pending-${") || handoff.includes("`pending-")) {
  pass("temp order ids use pending- prefix");
} else {
  fail("temp ids not prefixed");
}

if (
  handoff.includes("beginFulfillLock") &&
  status.includes("beginFulfillLock") &&
  status.includes("Do not abort in-flight create")
) {
  pass("status fulfill lock + no abort-on-cleanup");
} else {
  fail("status fulfill lock missing");
}

console.log("Order create single-path checks done");
