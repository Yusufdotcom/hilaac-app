/**
 * H4 residual: every /api/admin/* route must gate on profiles.is_active
 * (via requireActiveStaff or an explicit is_active check / helper).
 */
import fs from "fs";
import path from "path";

const root = "app/api/admin";
let passed = 0;
let failed = 0;

function pass(n, d = "") {
  passed += 1;
  console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
}
function fail(n, d = "") {
  failed += 1;
  console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.name === "route.ts") acc.push(p);
  }
  return acc;
}

const routes = walk(root);
if (routes.length === 0) {
  fail("found admin API routes");
  process.exit(1);
}
pass(`found ${routes.length} admin API routes`);

const helperSrc = fs.readFileSync("lib/auth/require-active-staff.ts", "utf8");
if (
  helperSrc.includes("is_active === false") &&
  helperSrc.includes("export async function requireActiveStaff")
) {
  pass("requireActiveStaff refuses inactive profiles");
} else {
  fail("requireActiveStaff refuses inactive profiles");
}

const reportsAuth = fs.readFileSync("lib/reports/auth.ts", "utf8");
if (reportsAuth.includes("is_active === false")) {
  pass("getVerifiedReportsContext checks is_active");
} else {
  fail("getVerifiedReportsContext checks is_active");
}

const loyaltyAuth = fs.readFileSync("lib/loyalty/staff-auth.ts", "utf8");
if (loyaltyAuth.includes("is_active === false")) {
  pass("getLoyaltyStaffContext checks is_active");
} else {
  fail("getLoyaltyStaffContext checks is_active");
}

for (const file of routes) {
  const src = fs.readFileSync(file, "utf8");
  const ok =
    src.includes("requireActiveStaff") ||
    src.includes("getLoyaltyStaffContext") ||
    src.includes("getVerifiedReportsContext") ||
    (src.includes("is_active") && src.includes("profiles"));
  if (ok) pass(`${file} gates is_active`);
  else fail(`${file} gates is_active`, "no requireActiveStaff / helper / is_active check");
}

console.log(`\nH4 API is_active: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
