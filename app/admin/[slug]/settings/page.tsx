import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { getOwnerBranches } from "@/lib/admin/owner-branches";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { ManageBranches } from "@/components/admin/settings/manage-branches";

export default async function SettingsPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { restaurant, profile } = await getRestaurantContext(params.slug);
  const branches = profile.role === "owner" && user ? await getOwnerBranches(supabase, user.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your restaurant profile, order types, and payment configuration.</p>
      </div>
      {profile.role === "owner" && (
        <ManageBranches
          branches={branches}
          currentSlug={params.slug}
          subscriptionTier={restaurant.subscription_tier}
        />
      )}
      <SettingsForm restaurant={restaurant} />
    </div>
  );
}
