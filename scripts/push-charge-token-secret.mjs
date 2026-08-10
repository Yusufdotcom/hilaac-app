import { spawnSync } from "child_process";
import fs from "fs";

function readEnvLocal(key) {
  const t = fs.readFileSync(".env.local", "utf8");
  const line = t.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing from .env.local`);
  let v = line.slice(key.length + 1);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const value = readEnvLocal("CHARGE_TOKEN_SECRET");
if (value.length < 32) {
  throw new Error("CHARGE_TOKEN_SECRET too short");
}

for (const target of ["production", "preview"]) {
  console.log(`Adding CHARGE_TOKEN_SECRET → ${target} (len=${value.length})`);
  const r = spawnSync(
    "npx",
    [
      "vercel",
      "env",
      "add",
      "CHARGE_TOKEN_SECRET",
      target,
      "--value",
      value,
      "--yes",
      "--force",
    ],
    { encoding: "utf8", shell: true }
  );
  console.log(r.stdout || "");
  if (r.stderr) console.error(r.stderr);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("Done. Redeploy production for the env to take effect.");
