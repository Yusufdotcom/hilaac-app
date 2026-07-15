import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { getAdminSlugRedirect } from "@/lib/admin/resolve-user-restaurant";
import { getOwnerBranches } from "@/lib/admin/owner-branches";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If URL contains a demo slug or a stale/wrong slug, send to the user's real restaurant.
  const slugRedirect = await getAdminSlugRedirect(supabase, user.id, params.slug);
  if (slugRedirect) redirect(slugRedirect);

  const { restaurant, profile } = await getRestaurantContext(params.slug, ["owner", "manager"]);

  const branches = profile.role === "owner" ? await getOwnerBranches(supabase, user.id) : [];

  const userName =
    profile.full_name?.trim() ||
    user.user_metadata?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "User";

  return (
    <AdminLayoutShell
      restaurantName={restaurant.branch_name?.trim() || restaurant.name}
      subscriptionTier={restaurant.subscription_tier}
      userName={userName}
      currentSlug={params.slug}
      branches={branches}
    >
      {children}
    </AdminLayoutShell>
  );
}
