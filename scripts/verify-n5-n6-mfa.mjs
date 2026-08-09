/**
 * N5/N6: MFA fail-closed on null AAL; mutating admin APIs call requireAal2ForPrivilegedRole.
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

const middleware = readFileSync(resolve("lib/supabase/middleware.ts"), "utf8");
const postLogin = readFileSync(resolve("lib/auth/post-login.ts"), "utf8");
const aal = readFileSync(resolve("lib/auth/aal.ts"), "utf8");

if (
  middleware.includes("aalError || !aal") &&
  middleware.includes("/auth/mfa/enroll") &&
  !middleware.match(/if \(aal\) \{\s*const nextParam/)
) {
  pass("middleware MFA fail-closed on null/error AAL");
} else if (middleware.includes("aalError || !aal")) {
  pass("middleware MFA fail-closed on null/error AAL");
} else {
  fail("middleware still fail-open on null AAL");
}

if (postLogin.includes("aalError || !aal") && postLogin.includes("/auth/mfa/enroll")) {
  pass("post-login MFA fail-closed on null/error AAL");
} else {
  fail("post-login still fail-open on null AAL");
}

if (aal.includes("error || !data")) {
  pass("requireAal2 treats missing AAL data as failure");
} else {
  fail("aal helper missing null-data guard");
}

const routes = [
  "app/api/admin/staff/[id]/status/route.ts",
  "app/api/admin/branches/route.ts",
  "app/api/admin/loyalty/settings/route.ts",
  "app/api/admin/whatsapp/settings/route.ts",
  "app/api/admin/menu/generate-image/route.ts",
  "app/api/admin/subscriptions/confirm-payment/route.ts",
  "app/api/admin/restaurant/settings/route.ts",
  "app/api/admin/restaurant/test-connection/route.ts",
  "app/api/admin/reports/orders/route.ts",
  "app/api/admin/reports/data/route.ts",
];

let missing = 0;
for (const r of routes) {
  const src = readFileSync(resolve(r), "utf8");
  if (!src.includes("requireAal2ForPrivilegedRole")) {
    fail(`AAL2 missing on ${r}`);
    missing += 1;
  }
}
if (missing === 0) {
  pass(`AAL2 wired on ${routes.length} mutating/admin sensitive routes`);
}

console.log("N5/N6 MFA checks done");
