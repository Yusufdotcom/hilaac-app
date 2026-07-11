import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginPath } from "@/lib/admin/resolve-user-restaurant";

/**
 * /admin — fallback entry when no slug is in the URL. Sends the user to
 * /admin/[slug]/dashboard where [slug] comes from their profile in the DB.
 */
export default async function AdminIndexPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const destination = await getPostLoginPath(supabase, user.id);
  if (!destination) redirect("/login?error=no-profile");

  redirect(destination);
}
