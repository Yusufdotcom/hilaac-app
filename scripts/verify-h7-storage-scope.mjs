/**
 * Live H7: storage upload policies require restaurant_id path prefix helper.
 */
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";

config({ path: ".env.local", quiet: true });

function env(k) {
  let v = process.env[k] ?? "";
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY") || env("SUPABASE_ANON_KEY");
const dbPass = env("SUPABASE_DB_PASSWORD");

if (!url || !anonKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

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

// 1) Catalog: policies use can_write_restaurant_storage
{
  const sqlPath = join(tmpdir(), `h7-pol-${Date.now()}.sql`);
  writeFileSync(
    sqlPath,
    `select polname, pg_get_expr(polwithcheck, polrelid) as with_check
     from pg_policy p
     join pg_class c on c.oid = p.polrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'storage' and c.relname = 'objects'
       and polname in (
         'staff upload menu-images',
         'staff update menu-images',
         'staff upload restaurant-logos',
         'staff update restaurant-logos'
       );`
  );
  try {
    const out = execSync(
      `npx supabase db query --linked -f "${sqlPath}"`,
      {
        encoding: "utf8",
        env: { ...process.env, SUPABASE_DB_PASSWORD: dbPass },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    const jsonStart = out.indexOf("{");
    const parsed = JSON.parse(out.slice(jsonStart));
    const rows = parsed.rows ?? [];
    const allScoped = rows.length >= 4 && rows.every((r) =>
      String(r.with_check ?? "").includes("can_write_restaurant_storage")
    );
    if (allScoped) pass("storage write policies use can_write_restaurant_storage", `n=${rows.length}`);
    else fail("storage write policies use can_write_restaurant_storage", JSON.stringify(rows));
  } catch (e) {
    fail("storage write policies use can_write_restaurant_storage", e?.stderr || e?.message || String(e));
  } finally {
    try {
      unlinkSync(sqlPath);
    } catch {
      // ignore
    }
  }
}

// 2) Function exists
{
  const sqlPath = join(tmpdir(), `h7-fn-${Date.now()}.sql`);
  writeFileSync(
    sqlPath,
    `select proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and proname = 'can_write_restaurant_storage';`
  );
  try {
    const out = execSync(`npx supabase db query --linked -f "${sqlPath}"`, {
      encoding: "utf8",
      env: { ...process.env, SUPABASE_DB_PASSWORD: dbPass },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(out.slice(out.indexOf("{")));
    if (parsed.rows?.length === 1) pass("can_write_restaurant_storage function exists");
    else fail("can_write_restaurant_storage function exists", JSON.stringify(parsed.rows));
  } catch (e) {
    fail("can_write_restaurant_storage function exists", e?.message ?? String(e));
  } finally {
    try {
      unlinkSync(sqlPath);
    } catch {
      // ignore
    }
  }
}

// 3) Anon cannot upload into a forged restaurant path
{
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const path = `${randomUUID()}/h7-probe.txt`;
  const { error } = await anon.storage
    .from("menu-images")
    .upload(path, new Blob(["h7"], { type: "text/plain" }), { upsert: true });
  if (error) pass("anon upload to menu-images rejected", error.message);
  else {
    fail("anon upload to menu-images rejected", "upload succeeded");
    await anon.storage.from("menu-images").remove([path]);
  }
}

// 4) Clients already prefix paths with restaurant id
{
  const menu = await import("fs").then((fs) =>
    fs.readFileSync("components/admin/menu/menu-item-dialog.tsx", "utf8")
  );
  const settings = await import("fs").then((fs) =>
    fs.readFileSync("components/admin/settings/settings-form.tsx", "utf8")
  );
  if (menu.includes("`${restaurantId}/") && settings.includes("`${restaurant.id}/")) {
    pass("upload clients use restaurant_id/ path prefix");
  } else {
    fail("upload clients use restaurant_id/ path prefix");
  }
}

console.log(`\nH7 storage scope: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
