/**
 * Pull service_role from linked Supabase project into .env.local.
 * Vercel env pull often leaves SUPABASE_SERVICE_ROLE_KEY empty.
 */
import { execSync } from "child_process";
import fs from "fs";

const dest = ".env.local";
const ref = fs.existsSync("supabase/.temp/project-ref")
  ? fs.readFileSync("supabase/.temp/project-ref", "utf8").trim()
  : null;

if (!ref) {
  console.error("No linked Supabase project-ref found");
  process.exit(1);
}

let out = "";
try {
  out = execSync(`npx supabase projects api-keys --project-ref ${ref} -o env`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  // CLI sometimes exits non-zero after printing keys (e.g. PostHog shutdown).
  out = String(err?.stdout ?? "");
}

const keys = new Map();
for (const line of out.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  keys.set(line.slice(0, i), v);
}

const service = keys.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const anon = keys.get("SUPABASE_ANON_KEY") || "";

if (!service) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing from supabase api-keys");
  process.exit(1);
}

let t = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : "";
function setKey(k, v) {
  const lines = t.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith(`${k}=`));
  const line = `${k}=${v}`;
  if (idx >= 0) lines[idx] = line;
  else lines.push(line);
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  t = lines.join("\n") + "\n";
}

setKey("SUPABASE_SERVICE_ROLE_KEY", service);
if (anon) setKey("SUPABASE_ANON_KEY", anon);
if (anon && !/NEXT_PUBLIC_SUPABASE_ANON_KEY=.+\S/.test(t)) {
  setKey("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
}

fs.writeFileSync(dest, t);
console.log("synced service_role from project", ref, "len=" + service.length);
console.log("has_live_supabase", true);
