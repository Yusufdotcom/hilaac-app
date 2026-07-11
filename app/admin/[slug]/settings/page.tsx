import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { SettingsForm } from "@/components/admin/settings/settings-form";

export default async function SettingsPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your restaurant profile, order types, and payment configuration.</p>
      </div>
      <SettingsForm restaurant={restaurant} />
    </div>
  );
}
