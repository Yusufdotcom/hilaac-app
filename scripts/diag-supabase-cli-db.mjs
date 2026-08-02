/**
 * Diagnose why supabase CLI can't reach remote Postgres.
 * Prints lengths/flags only — never secret values.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const root = process.cwd();
const tempDir = path.join(root, "supabase", ".temp");

function envLen(name) {
  const v = process.env[name];
  return v && String(v).trim().length > 0 ? String(v).trim().length : 0;
}

function readLocalEnvLens() {
  const file = path.join(root, ".env.local");
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i);
    if (!/PASSWORD|DATABASE_URL|POSTGRES/i.test(k)) continue;
    let v = t.slice(i + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v.trim().length;
  }
  return out;
}

console.log("cli_version", (() => {
  try {
    return execSync("npx supabase --version", { encoding: "utf8" }).trim();
  } catch (e) {
    return String(e.message);
  }
})());

console.log("process_env", {
  SUPABASE_DB_PASSWORD: envLen("SUPABASE_DB_PASSWORD"),
  DATABASE_URL: envLen("DATABASE_URL"),
  PGPASSWORD: envLen("PGPASSWORD"),
});

console.log("dotenv_local_lens", readLocalEnvLens());

if (fs.existsSync(tempDir)) {
  const files = fs.readdirSync(tempDir);
  console.log("temp_files", files);
  for (const f of files) {
    const p = path.join(tempDir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      console.log(`temp.${f}`, "DIR");
      continue;
    }
    const raw = fs.readFileSync(p, "utf8").trim();
    if (f === "pooler-url") {
      // Redact credentials; show host/port/user pattern only
      try {
        const u = new URL(raw.replace(/^postgresql:/, "http:"));
        console.log("temp.pooler-url", {
          host: u.hostname,
          port: u.port,
          user: decodeURIComponent(u.username),
          hasPasswordPlaceholder: /YOUR-PASSWORD|\[YOUR-PASSWORD\]/i.test(raw),
          passwordLen: decodeURIComponent(u.password || "").length,
        });
      } catch {
        console.log("temp.pooler-url", `len=${raw.length}`);
      }
      continue;
    }
    if (/password|secret|token/i.test(f)) {
      console.log(`temp.${f}`, `len=${raw.length}`);
    } else if (raw.length < 240) {
      console.log(`temp.${f}`, raw);
    } else {
      console.log(`temp.${f}`, `len=${raw.length}`);
    }
  }
} else {
  console.log("temp_files", "MISSING");
}

// TCP reachability to direct host vs pooler (no auth)
async function probe(host, port) {
  const net = await import("net");
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 8000 });
    const started = Date.now();
    socket.on("connect", () => {
      const ms = Date.now() - started;
      socket.destroy();
      resolve({ ok: true, ms });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, err: "timeout" });
    });
    socket.on("error", (e) => {
      resolve({ ok: false, err: e.code || e.message });
    });
  });
}

const ref = fs.existsSync(path.join(tempDir, "project-ref"))
  ? fs.readFileSync(path.join(tempDir, "project-ref"), "utf8").trim()
  : "ochbvlyunefjatwoxqup";

const probes = {
  direct_5432: await probe(`db.${ref}.supabase.co`, 5432),
  pooler_5432: await probe("aws-0-eu-central-1.pooler.supabase.com", 5432),
  pooler_6543: await probe("aws-0-eu-central-1.pooler.supabase.com", 6543),
};
console.log("tcp_probes", probes);
