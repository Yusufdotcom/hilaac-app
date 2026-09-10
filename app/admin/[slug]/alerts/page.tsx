import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { createClient } from "@/lib/supabase/server";
import { fetchRestaurantAlerts } from "@/lib/alerts/fetch-alerts";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { AlertsList } from "@/components/admin/alerts/alerts-list";

export const dynamic = "force-dynamic";

export default async function AlertsPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const supabase = createClient();
  const alerts = await fetchRestaurantAlerts(supabase, restaurant);

  return (
    <div className="w-full min-w-0 max-w-full space-y-5">
      <AdminPageIntro>
        Live signals from payments, billing, revenue, and menu margins — act on the ones that matter.
      </AdminPageIntro>
      <AlertsList alerts={alerts} />
    </div>
  );
}
