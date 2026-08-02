/**
 * Run Supabase CLI DB commands with a persistent password from .env.local.
 *
 * Why: this machine has no working IPv6, so `supabase link --skip-pooler` fails
 * (direct host is AAAA-only). The IPv4 pooler path must be used, but the CLI's
 * temporary `cli_login_postgres` role is unreliable through Supavisor. Setting
 * SUPABASE_DB_PASSWORD makes the CLI authenticate as the real postgres role.
 *
 * Usage:
 *   node scripts/supabase-db.mjs db push
 *   node scripts/supabase-db.mjs db query --linked "select 1"
 *   node scripts/supabase-db.mjs migration list --linked
 */
import { spawnSync } from "child_process";
import { config } from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";

config({ path: ".env.local", quiet: true });

/**
 * npm/PowerShell often splits `npm run db:query -- "select 1 as ok"` into
 * separate argv tokens. Re-join positional SQL and pass via -f for reliability.
 */
function normalizeArgs(rawArgs) {
  const isDbQuery =
    rawArgs[0] === "db" && rawArgs[1] === "query";
  if (!isDbQuery) return { args: rawArgs, tmp: null };

  const out = ["db", "query"];
  const sqlParts = [];
  let i = 2;
  while (i < rawArgs.length) {
    const a = rawArgs[i];
    if (a === "-f" || a === "--file") {
      out.push(a, rawArgs[i + 1]);
      i += 2;
      continue;
    }
    if (a === "--linked" || a === "--local" || a.startsWith("-")) {
      out.push(a);
      i += 1;
      continue;
    }
    sqlParts.push(a);
    i += 1;
  }

  if (sqlParts.length === 0) return { args: out, tmp: null };

  const sql = sqlParts.join(" ").trim();
  const tmp = path.join(
    os.tmpdir(),
    `hilaac-db-query-${process.pid}-${Date.now()}.sql`
  );
  fs.writeFileSync(tmp, sql.endsWith(";") ? sql : `${sql};\n`, "utf8");
  out.push("-f", tmp);
  return { args: out, tmp };
}

function trimEnv(v) {
  if (v == null) return "";
  let s = String(v).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

const password =
  trimEnv(process.env.SUPABASE_DB_PASSWORD) ||
  trimEnv(process.env.POSTGRES_PASSWORD);

if (!password) {
  console.error(`Missing database password for Supabase CLI.

Add this to .env.local (gitignored) once — not as a per-session export:

  SUPABASE_DB_PASSWORD=<Database password from Supabase Dashboard>
  # Project Settings → Database → Database password
  # (or reset it there if unknown)

Then re-run:
  npm run db:push
  # or: node scripts/supabase-db.mjs db query --linked "select 1"

Do NOT use --skip-pooler on this network: the direct DB host is IPv6-only
and this machine times out on IPv6. Stay on the IPv4 pooler + password.`);
  process.exit(1);
}

const rawArgs = process.argv.slice(2);
if (rawArgs.length === 0) {
  console.error("Usage: node scripts/supabase-db.mjs <supabase args…>");
  process.exit(1);
}

const { args, tmp } = normalizeArgs(rawArgs);

// Ensure link cache prefers pooler (IPv4). If a prior --skip-pooler left no
// pooler-url, remind to re-link once.
if (!fs.existsSync("supabase/.temp/pooler-url")) {
  console.warn(
    "warn: supabase/.temp/pooler-url missing — run:\n  npx supabase link --project-ref ochbvlyunefjatwoxqup --yes"
  );
}

const env = {
  ...process.env,
  SUPABASE_DB_PASSWORD: password,
};

try {
  const result = spawnSync("npx", ["supabase", ...args], {
    stdio: "inherit",
    env,
    shell: true,
  });
  process.exit(result.status ?? 1);
} finally {
  if (tmp) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}
