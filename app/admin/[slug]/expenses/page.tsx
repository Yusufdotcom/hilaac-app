import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { createClient } from "@/lib/supabase/server";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { fetchExpensesPageData } from "@/lib/expenses/fetch-expenses";
import { ExpensesView } from "@/components/admin/expenses/expenses-view";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const canUse = canUseFeature(restaurant.subscription_tier, "expenses_pnl");
  const supabase = createClient();
  const data = canUse ? await fetchExpensesPageData(supabase, restaurant.id) : null;

  return (
    <ExpensesView restaurantId={restaurant.id} data={data} gated={!canUse} />
  );
}
