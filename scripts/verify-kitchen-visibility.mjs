/**
 * Kitchen visibility: acceptance gate only (payment-independent).
 */
import { isKitchenVisible } from "../lib/order/kitchen-visibility.ts";
import { isAwaitingAcceptance } from "../lib/order/acceptance.ts";

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
    name: "unaccepted new unpaid → kitchen hidden",
    order: {
      status: "new",
      payment_status: "pending_cashier_confirmation",
      billing_model: "pay_after",
      accepted_at: null,
    },
    want: false,
  },
  {
    name: "accepted new unpaid pay_after → kitchen visible",
    order: {
      status: "new",
      payment_status: "pending_cashier_confirmation",
      billing_model: "pay_after",
      accepted_at: "2026-08-11T00:00:00Z",
    },
    want: true,
  },
  {
    name: "accepted preparing unpaid → kitchen visible",
    order: {
      status: "preparing",
      payment_status: "pending_cashier_confirmation",
      accepted_at: "2026-08-11T00:00:00Z",
    },
    want: true,
  },
  {
    name: "unaccepted preparing → kitchen hidden",
    order: {
      status: "preparing",
      payment_status: "paid",
      accepted_at: null,
    },
    want: false,
  },
  {
    name: "accepted unpaid pay_before → kitchen visible (payment irrelevant)",
    order: {
      status: "new",
      payment_status: "pending",
      billing_model: "pay_before",
      accepted_at: "2026-08-11T00:00:00Z",
    },
    want: true,
  },
  {
    name: "awaiting_payment never visible even if accepted",
    order: {
      status: "awaiting_payment",
      payment_status: "pending",
      accepted_at: "2026-08-11T00:00:00Z",
    },
    want: false,
  },
];

for (const c of cases) {
  const got = isKitchenVisible(c.order);
  if (got === c.want) pass(c.name);
  else fail(c.name, `got ${got} want ${c.want}`);
}

if (isAwaitingAcceptance({ status: "new", accepted_at: null })) {
  pass("awaiting acceptance: new + null");
} else fail("awaiting acceptance: new + null");

if (!isAwaitingAcceptance({ status: "new", accepted_at: "2026-08-11T00:00:00Z" })) {
  pass("not awaiting after accept");
} else fail("not awaiting after accept");

if (!isAwaitingAcceptance({ status: "awaiting_payment", accepted_at: null })) {
  pass("awaiting_payment not in accept queue");
} else fail("awaiting_payment not in accept queue");

if (isAwaitingAcceptance({ status: "preparing", accepted_at: null })) {
  pass("preparing without accept still in accept queue");
} else fail("preparing without accept still in accept queue");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
