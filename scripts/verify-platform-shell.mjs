/**
 * Structural verification: /platform is a tenant-agnostic shell.
 * Does not require auth cookies — checks source contracts.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

let passed = 0;
let failed = 0;
function pass(n, d) {
  passed += 1;
  console.log("PASS ", n, d ?? "");
}
function fail(n, d) {
  failed += 1;
  console.log("FAIL ", n, d ?? "");
}

const root = process.cwd();
function read(rel) {
  return readFileSync(resolve(root, rel), "utf8");
}

// Layout must use PlatformShell only — never AdminLayoutShell
const layout = read("app/platform/layout.tsx");
if (
  layout.includes('from "@/components/platform/platform-shell"') &&
  !layout.includes('from "@/components/admin/admin-layout-shell"')
) {
  pass("platform layout uses PlatformShell only");
} else fail("platform layout uses PlatformShell only");

if (!layout.includes("brandColor") && !layout.includes("restaurantName") && !layout.includes("getRestaurantContext")) {
  pass("platform layout has zero restaurant branding props");
} else fail("platform layout has zero restaurant branding props");

// Shell branding
const shell = read("components/platform/platform-shell.tsx");
if (shell.includes('data-platform-shell="true"') && shell.includes("Hilaac") && shell.includes("Platform")) {
  pass("platform shell marks itself + Hilaac branding");
} else fail("platform shell marks itself + Hilaac branding");

if (!shell.includes("admin-shell") && !shell.includes("--admin-brand") && !shell.includes("AdminSidebar")) {
  pass("platform shell has no admin-shell / brand tokens / AdminSidebar");
} else fail("platform shell has no admin-shell / brand tokens / AdminSidebar");

for (const label of ["All Restaurants", "Pending Renewals", "Platform Settings"]) {
  if (shell.includes(label)) pass(`nav: ${label}`);
  else fail(`nav: ${label}`);
}

// Routes exist
for (const p of [
  "app/platform/restaurants/page.tsx",
  "app/platform/renewals/page.tsx",
  "app/platform/settings/page.tsx",
]) {
  if (existsSync(resolve(root, p))) pass(`route exists ${p}`);
  else fail(`route exists ${p}`);
}

const dash = read("app/platform/dashboard/page.tsx");
if (dash.includes('redirect("/platform/restaurants")')) {
  pass("legacy /platform/dashboard redirects to restaurants");
} else fail("legacy /platform/dashboard redirects to restaurants");

// Account menu entry — hard nav out of restaurant admin
const menu = read("components/admin/admin-user-menu.tsx");
if (
  menu.includes("isPlatformAdmin") &&
  menu.includes('window.location.assign("/platform/restaurants")') &&
  menu.includes("Hilaac Platform")
) {
  pass("account menu: Hilaac Platform → hard nav /platform/restaurants");
} else fail("account menu: Hilaac Platform → hard nav /platform/restaurants");

// Old combined dashboard component must be gone
if (!existsSync(resolve(root, "components/platform/platform-dashboard.tsx"))) {
  pass("removed combined platform-dashboard (split into pages)");
} else fail("removed combined platform-dashboard (split into pages)");

// Middleware still gates on is_platform_admin + unconditional MFA
const mw = read("lib/supabase/middleware.ts");
if (
  mw.includes("isPlatform") &&
  mw.includes("isPlatformAdmin") &&
  mw.includes("Unconditional MFA")
) {
  pass("middleware gates /platform on is_platform_admin");
} else fail("middleware gates /platform on is_platform_admin");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
