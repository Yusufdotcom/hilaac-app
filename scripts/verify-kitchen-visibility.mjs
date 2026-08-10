/**
 * Kitchen visibility: same rules for new/preparing/ready; pay_after vs pay_before.
 */
import { isKitchenVisible } from "../lib/order/kitchen-visibility.ts";

let passed = 0;
let failed = 0;
function pass(n) {
  passed += 1;
  console.log("PASS ", n);
}
function fail(n, d) {
  failed += 1;
  console.log("FAIL ", n, d ?? "");
}

const cases = [
  {
    name: "pay_after + new + unpaid → visible",
    order: { status: "new", payment_status: "pending_cashier_confirmation", billing_model: "pay_after" },
    want: true,
  },
  {
    name: "pay_after + preparing + unpaid → visible",
    order: {
      status: "preparing",
      payment_status: "pending_cashier_confirmation",
      billing_model: "pay_after",
    },
    want: true,
  },
  {
    name: "pay_after + ready + unpaid → visible",
    order: { status: "ready", payment_status: "pending_cashier_confirmation", billing_model: "pay_after" },
    want: true,
  },
  {
    name: "pay_before + new + unpaid → hidden",
    order: { status: "new", payment_status: "pending_cashier_confirmation", billing_model: "pay_before" },
    want: false,
  },
  {
    name: "pay_before + preparing + unpaid → hidden",
    order: {
      status: "preparing",
      payment_status: "pending_cashier_confirmation",
      billing_model: "pay_before",
    },
    want: false,
  },
  {
    name: "pay_before + new + paid → visible",
    order: { status: "new", payment_status: "paid", billing_model: "pay_before" },
    want: true,
  },
  {
    name: "pay_before + preparing + paid → visible",
    order: { status: "preparing", payment_status: "paid", billing_model: "pay_before" },
    want: true,
  },
  {
    name: "awaiting_payment never visible",
    order: { status: "awaiting_payment", payment_status: "pending", billing_model: "pay_before" },
    want: false,
  },
];

for (const c of cases) {
  const got = isKitchenVisible(c.order);
  if (got === c.want) pass(c.name);
  else fail(c.name, `got ${got} want ${c.want}`);
}

// Prove new/preparing/ready share identical gate for a given payment+billing pair
const unpaidAfter = { payment_status: "pending_cashier_confirmation", billing_model: "pay_after" };
const a = isKitchenVisible({ status: "new", ...unpaidAfter });
const b = isKitchenVisible({ status: "preparing", ...unpaidAfter });
const c = isKitchenVisible({ status: "ready", ...unpaidAfter });
if (a === b && b === c) pass("new/preparing/ready identical for unpaid pay_after");
else fail("new/preparing/ready identical", `${a},${b},${c}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
