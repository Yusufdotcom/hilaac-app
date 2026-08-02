import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { getOwnerBranches } from "@/lib/admin/owner-branches";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { ManageBranches } from "@/components/admin/settings/manage-branches";
import { LoyaltySettingsCard } from "@/components/admin/settings/loyalty-settings-card";
import { WhatsAppSettingsCard } from "@/components/admin/settings/whatsapp-settings-card";
import { MfaSettingsCard } from "@/components/admin/settings/mfa-settings-card";
import { roleRequiresMfa } from "@/lib/auth/roles";
import type { LoyaltyAdminStats, LoyaltySettings } from "@/lib/loyalty/types";
import {
  canUseWhatsAppReengagement,
  estimatedCostUsd,
  getTwilioConfig,
  isWhatsAppDryRun,
} from "@/lib/whatsapp/config";

export default async function SettingsPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { restaurant, profile } = await getRestaurantContext(params.slug);
  const branches = profile.role === "owner" && user ? await getOwnerBranches(supabase, user.id) : [];

  const admin = createAdminClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    { data: loyaltySettings },
    { count: customersWithProgress },
    { count: customersWithRewards },
    { count: totalRedemptions },
    { data: whatsappSettings },
    { data: whatsappLogs },
  ] = await Promise.all([
    admin
      .from("loyalty_settings")
      .select("restaurant_id, enabled, target_order_count, reward_description, created_at, updated_at")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle(),
    admin
      .from("loyalty_progress")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .or("current_count.gt.0,available_rewards.gt.0"),
    admin
      .from("loyalty_progress")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .gt("available_rewards", 0),
    admin
      .from("loyalty_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id),
    admin
      .from("whatsapp_settings")
      .select(
        "order_ready_enabled, reengagement_enabled, reengagement_idle_days, reengagement_min_interval_days"
      )
      .eq("restaurant_id", restaurant.id)
      .maybeSingle(),
    admin
      .from("whatsapp_message_log")
      .select("message_type, status, estimated_cost_usd")
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", monthStart.toISOString())
      .in("status", ["dry_run", "sent", "queued"]),
  ]);

  const loyaltyStats: LoyaltyAdminStats = {
    customers_with_progress: customersWithProgress ?? 0,
    customers_with_rewards: customersWithRewards ?? 0,
    total_redemptions: totalRedemptions ?? 0,
  };

  let utilityCount = 0;
  let marketingCount = 0;
  let estimatedCost = 0;
  for (const row of whatsappLogs ?? []) {
    if (row.message_type === "order_ready") utilityCount += 1;
    if (row.message_type === "reengagement") marketingCount += 1;
    estimatedCost += Number(row.estimated_cost_usd) || 0;
  }

  const twilio = getTwilioConfig();

  return (
    <div className="w-full space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your restaurant profile, order types, and payment configuration.
        </p>
      </div>
      {profile.role === "owner" && (
        <ManageBranches
          branches={branches}
          currentSlug={params.slug}
          subscriptionTier={restaurant.subscription_tier}
        />
      )}
      {roleRequiresMfa(profile.role) ? <MfaSettingsCard /> : null}
      <SettingsForm restaurant={restaurant} />
      <LoyaltySettingsCard
        slug={params.slug}
        restaurantId={restaurant.id}
        initialSettings={(loyaltySettings as LoyaltySettings | null) ?? null}
        initialStats={loyaltyStats}
      />
      <WhatsAppSettingsCard
        slug={params.slug}
        initialSettings={{
          order_ready_enabled: whatsappSettings?.order_ready_enabled ?? false,
          reengagement_enabled: whatsappSettings?.reengagement_enabled ?? false,
          reengagement_idle_days: whatsappSettings?.reengagement_idle_days ?? 14,
          reengagement_min_interval_days:
            whatsappSettings?.reengagement_min_interval_days ?? 21,
        }}
        initialUsage={{
          month_utility_messages: utilityCount,
          month_marketing_messages: marketingCount,
          month_estimated_cost_usd: Math.round(estimatedCost * 100) / 100,
          utility_unit_cost_usd: estimatedCostUsd("order_ready"),
          marketing_unit_cost_usd: estimatedCostUsd("reengagement"),
        }}
        initialMeta={{
          dry_run: isWhatsAppDryRun(),
          twilio_configured: twilio.configured,
          templates_configured: Boolean(
            twilio.orderReadyContentSid && twilio.reengageContentSid
          ),
          reengagement_allowed: canUseWhatsAppReengagement(restaurant.subscription_tier),
        }}
      />
    </div>
  );
}
