import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createClient } from "@/lib/supabase/server";
import { DeynAccountsView } from "@/components/admin/deyn/deyn-accounts-view";
import type { DeynAccount } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DeynPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const canUse = canUseFeature(restaurant.subscription_tier, "deyn_ledger");

  let accounts: DeynAccount[] = [];
  if (canUse) {
    const supabase = createClient();
    const { data } = await supabase
      .from("deyn_accounts")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false });
    accounts = (data as DeynAccount[] | null) ?? [];
  }

  return (
    <DeynAccountsView slug={params.slug} initialAccounts={accounts} gated={!canUse} />
  );
}
