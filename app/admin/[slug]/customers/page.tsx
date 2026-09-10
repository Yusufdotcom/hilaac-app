import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { createClient } from "@/lib/supabase/server";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { fetchCustomerIntelligence } from "@/lib/customers/fetch-customer-intelligence";
import { CustomersView } from "@/components/admin/customers/customers-view";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const canUse = canUseFeature(restaurant.subscription_tier, "customer_intelligence");
  const supabase = createClient();
  const data = canUse ? await fetchCustomerIntelligence(supabase, restaurant.id) : null;

  return <CustomersView data={data} gated={!canUse} />;
}
