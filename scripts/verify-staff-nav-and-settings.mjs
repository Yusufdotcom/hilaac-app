/**
 * Source checks for staff Back-to-Admin gating + Cashier in switcher + Settings gap fixes.
 */
import fs from "fs";

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

const sidebar = fs.readFileSync("components/staff/staff-sidebar.tsx", "utf8");
const layout = fs.readFileSync("components/admin/admin-layout-shell.tsx", "utf8");
const radio = fs.readFileSync("components/ui/radio-group.tsx", "utf8");
const access = fs.readFileSync("components/admin/staff-access/staff-access-board.tsx", "utf8");
const menuImg = fs.readFileSync("components/admin/menu/menu-item-image.tsx", "utf8");
const menuSec = fs.readFileSync("components/admin/menu/menu-item-section.tsx", "utf8");

if (sidebar.includes("Back to Admin") && sidebar.includes("canReturnToAdmin")) {
  pass("staff sidebar has Back to Admin for owner/manager");
} else fail("staff sidebar has Back to Admin for owner/manager");

if (
  sidebar.includes('role === "owner" || role === "manager"') ||
  sidebar.includes("role === \"owner\" || role === \"manager\"")
) {
  pass("Back to Admin gated on owner|manager only");
} else fail("Back to Admin gated on owner|manager only");

if (
  sidebar.includes('roles: ["owner", "manager", "cashier"]') ||
  sidebar.includes('roles: ["owner", "manager", "cashier"] as UserRole[]')
) {
  pass("Cashier appears in switcher for owner/manager");
} else fail("Cashier appears in switcher for owner/manager");

if (!sidebar.includes('roles: ["cashier"] as UserRole[]')) {
  pass("Cashier nav no longer cashier-only");
} else fail("Cashier nav no longer cashier-only");

if (layout.includes("Avoid flex-1 on the content shell") || !layout.includes("max-w-7xl flex-1 p-4")) {
  pass("admin content shell no longer flex-1 inflated");
} else fail("admin content shell no longer flex-1 inflated");

if (radio.includes("shrink-0") && !radio.includes("aspect-square")) {
  pass("RadioGroupItem no longer aspect-square stretch risk");
} else fail("RadioGroupItem no longer aspect-square stretch risk");

if (
  access.includes("Each dashboard has its own link") &&
  access.includes("Never") &&
  access.includes("owner login") &&
  access.includes("shared tablet")
) {
  pass("Staff Access discoverability banner present");
} else fail("Staff Access discoverability banner present");

if (menuImg.includes("animate-pulse") && menuSec.includes("MenuItemImage")) {
  pass("menu grid uses image skeleton loader");
} else fail("menu grid uses image skeleton loader");

console.log(`\nStaff nav / settings / menu: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
