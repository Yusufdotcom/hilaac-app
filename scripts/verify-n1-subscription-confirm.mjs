/**
 * N1: Manual subscription confirm is fail-closed without env flag;
 * source requires txRef + AAL2 + admin client.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function pass(name) {
  console.log("PASS ", name);
}
function fail(name, detail) {
  console.error("FAIL ", name, detail ?? "");
  process.exitCode = 1;
}

const routePath = resolve("app/api/admin/subscriptions/confirm-payment/route.ts");
const src = readFileSync(routePath, "utf8");

if (src.includes("ALLOW_MANUAL_SUBSCRIPTION_CONFIRM") && src.includes("manual_confirm_disabled")) {
  pass("source fail-closed when ALLOW_MANUAL_SUBSCRIPTION_CONFIRM unset");
} else {
  fail("source missing fail-closed env gate");
}

if (src.includes("txRef") && src.includes("createAdminClient") && src.includes("requireAal2ForPrivilegedRole")) {
  pass("source requires txRef + admin client + AAL2");
} else {
  fail("source missing txRef / admin / AAL2 gates");
}

const base = process.env.N1_BASE_URL ?? process.env.C1_BASE_URL ?? "http://localhost:3000";
try {
  const res = await fetch(`${base}/api/admin/subscriptions/confirm-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantId: "00000000-0000-0000-0000-000000000000",
      method: "evc",
      txRef: "TEST1234",
    }),
  });
  // Unauthenticated or env-disabled both reject (401 or 403).
  if (res.status === 401 || res.status === 403) {
    pass(`live unauthenticated/disabled → ${res.status}`);
  } else {
    fail("live confirm-payment", `unexpected status ${res.status}`);
  }
} catch (e) {
  console.log(
    "SKIP live HTTP —",
    e instanceof Error ? e.message : e,
    "(start npm run dev to exercise)"
  );
}

console.log("N1 subscription confirm checks done");
