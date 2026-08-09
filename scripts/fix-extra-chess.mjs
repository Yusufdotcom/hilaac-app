import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const id = "4c467725-6acf-4e8e-adbd-c3625536da3b";
const { data: before } = await admin.from("add_ons").select("id,name").eq("id", id).maybeSingle();
console.log("before", before);

const { error } = await admin.from("add_ons").update({ name: "Extra Cheese" }).eq("id", id);
if (error) {
  console.error("FAIL", error.message);
  process.exit(1);
}

const { data: after } = await admin.from("add_ons").select("id,name").eq("id", id).maybeSingle();
console.log("after", after);
if (after?.name !== "Extra Cheese") {
  console.error("FAIL name not updated");
  process.exit(1);
}
console.log("PASS Extra Chess → Extra Cheese");
