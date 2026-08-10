/**
 * N1: Owner self-confirm is retired (410). Confirmation is platform_admin only.
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

if (src.includes("owner_self_confirm_retired") && src.includes("410")) {
  pass("owner self-confirm retired with 410");
} else {
  fail("owner self-confirm not retired");
}

if (src.includes("createAdminClient") && src.includes("subscription_end_date")) {
  fail("retired route must not still update subscription_end_date");
} else {
  pass("retired route does not extend subscriptions");
}

const platformConfirm = resolve("app/api/platform/renewals/[id]/confirm/route.ts");
const platformSrc = readFileSync(platformConfirm, "utf8");
if (platformSrc.includes("requirePlatformAdmin") && platformSrc.includes("subscription_end_date")) {
  pass("platform confirm requires requirePlatformAdmin + extends end date");
} else {
  fail("platform confirm missing gates");
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
  if (res.status === 410) {
    pass(`live owner confirm → 410`);
  } else if (res.status === 401 || res.status === 403) {
    pass(`live owner confirm rejected → ${res.status}`);
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
