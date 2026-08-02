/**
 * H5: verify test-connection auth gates.
 * Prefer live HTTP if BASE_URL is up; always assert source/client wiring.
 */
import fs from "fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const base = (process.env.H5_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

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

const src = fs.readFileSync("app/api/admin/restaurant/test-connection/route.ts", "utf8");
if (src.includes('["owner", "manager"]') && src.includes("isPrimary") && src.includes("isOwner")) {
  pass("source enforces owner/manager + tenant match");
} else {
  fail("source enforces owner/manager + tenant match");
}
if (src.includes("restaurant_id") && src.includes("createAdminClient")) {
  pass("source loads restaurant and checks ownership");
} else {
  fail("source loads restaurant and checks ownership");
}
if (!src.includes("if (!user) return") && !src.includes('if (!user) return NextResponse.json({ error: "Unauthorized" }')) {
  // keep flexible
}
if (src.includes("Unauthorized") && src.includes("Forbidden")) {
  pass("source returns 401/403 for auth failures");
} else {
  fail("source returns 401/403 for auth failures");
}

const form = fs.readFileSync("components/admin/settings/settings-form.tsx", "utf8");
if (form.includes("restaurant_id: restaurant.id")) {
  pass("settings form sends restaurant_id");
} else {
  fail("settings form sends restaurant_id");
}

try {
  const res = await fetch(`${base}/api/admin/restaurant/test-connection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "evc",
      merchantId: "m1",
      apiKey: "k1",
      restaurant_id: "00000000-0000-0000-0000-000000000001",
    }),
  });
  if (res.status === 401) pass("live unauthenticated → 401", base);
  else fail("live unauthenticated → 401", `got ${res.status} from ${base}`);
} catch (e) {
  fail(
    "live unauthenticated → 401",
    `server not reachable at ${base} (${e?.message ?? e}). Start \`npm run dev\` and re-run.`
  );
}

console.log(`\nH5 test-connection: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
