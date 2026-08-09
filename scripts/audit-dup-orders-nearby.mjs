import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const restId = "16681f63-f393-4645-8641-bd4437d8a744";
const around = "2026-08-09T12:39:04.953Z"; // UTC approx of +03:00 create

const { data } = await admin
  .from("orders")
  .select("id, order_number, customer_phone, total, created_at, table_id, tables(table_number)")
  .eq("restaurant_id", restId)
  .gte("created_at", "2026-08-09T12:30:00Z")
  .lte("created_at", "2026-08-09T12:50:00Z")
  .order("created_at", { ascending: true });

console.log("Orders near incident window:", data?.length ?? 0);
for (const o of data ?? []) console.log(JSON.stringify(o));

const { data: missing } = await admin
  .from("orders")
  .select("id")
  .eq("id", "306596d4-bb77-41c1-879a-42e4d6a49171");
console.log("306596d4 exists?", Boolean(missing?.length));
