import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { createClient } from "@/lib/supabase/server";
import { CampaignsView } from "@/components/admin/campaigns/campaigns-view";
import type { Campaign } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const canUse = canUseFeature(restaurant.subscription_tier, "campaign_codes_basic");
  const canAnalytics = canUseFeature(restaurant.subscription_tier, "campaign_analytics");

  let campaigns: Campaign[] = [];
  let analytics: Record<
    string,
    { redemptions: number; discount_given: number; revenue: number }
  > | null = null;

  if (canUse) {
    const supabase = createClient();
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false });
    campaigns = (data as Campaign[] | null) ?? [];

    if (canAnalytics && campaigns.length > 0) {
      const { data: redemptions } = await supabase
        .from("campaign_redemptions")
        .select("campaign_id, discount_applied, order_total_after")
        .eq("restaurant_id", restaurant.id)
        .in(
          "campaign_id",
          campaigns.map((c) => c.id)
        );
      analytics = {};
      for (const row of redemptions ?? []) {
        const key = row.campaign_id as string;
        const cur = analytics[key] ?? { redemptions: 0, discount_given: 0, revenue: 0 };
        cur.redemptions += 1;
        cur.discount_given += Number(row.discount_applied ?? 0) || 0;
        cur.revenue += Number(row.order_total_after ?? 0) || 0;
        analytics[key] = cur;
      }
    }
  }

  return (
    <CampaignsView
      slug={params.slug}
      initialCampaigns={campaigns}
      initialAnalytics={analytics}
      canAnalytics={canAnalytics}
      gated={!canUse}
    />
  );
}
