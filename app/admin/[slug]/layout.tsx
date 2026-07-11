import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { getAdminSlugRedirect } from "@/lib/admin/resolve-user-restaurant";

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

  const { restaurant } = await getRestaurantContext(params.slug, ["owner", "manager"]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <AdminSidebar restaurantName={restaurant.name} subscriptionTier={restaurant.subscription_tier} />
      <main className="app-light-surface relative z-0 ml-64 min-h-screen min-w-0 overflow-y-auto text-[#0F172A]">
        <div className="p-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
