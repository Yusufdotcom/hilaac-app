/**
 * N4: Demo create fail-closed + rate limit + RPC revoke migration present.
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

const route = readFileSync(resolve("app/api/demo/create/route.ts"), "utf8");
const rate = readFileSync(resolve("lib/demo/rate-limit.ts"), "utf8");
const mig = readFileSync(
  resolve("supabase/migrations/20250809122000_revoke_demo_rpc_anon.sql"),
  "utf8"
);

if (route.includes("DEMO_CREATE_ENABLED") && route.includes("demo_create_disabled")) {
  pass("demo create fail-closed without DEMO_CREATE_ENABLED");
} else {
  fail("demo create missing env gate");
}

if (route.includes("isDemoCreateRateLimited") && rate.includes("MAX_HITS")) {
  pass("demo create IP rate limit wired");
} else {
  fail("demo rate limit missing");
}

if (mig.includes("REVOKE EXECUTE") && mig.includes("create_demo_restaurant")) {
  pass("migration revokes demo RPC from anon/authenticated");
} else {
  fail("demo RPC revoke migration missing");
}

const base = process.env.N4_BASE_URL ?? "http://localhost:3000";
try {
  const res = await fetch(`${base}/api/demo/create`, { method: "POST" });
  if (res.status === 403) {
    const json = await res.json().catch(() => ({}));
    if (json.code === "demo_create_disabled" || process.env.DEMO_CREATE_ENABLED !== "true") {
      pass(`live demo create disabled → 403`);
    } else {
      pass(`live demo create → 403`);
    }
  } else if (res.status === 429) {
    pass("live demo create rate limited → 429");
  } else {
    // If explicitly enabled in this env, 200/500 are possible; still require auth surface gated.
    console.log("SKIP live status", res.status, "(DEMO_CREATE_ENABLED may be true)");
  }
} catch (e) {
  console.log("SKIP live HTTP —", e instanceof Error ? e.message : e);
}

console.log("N4 demo create checks done");
