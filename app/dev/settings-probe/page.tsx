import { AdminBrandProvider } from "@/components/admin/admin-brand-context";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { LoyaltySettingsCard } from "@/components/admin/settings/loyalty-settings-card";
import { WhatsAppSettingsCard } from "@/components/admin/settings/whatsapp-settings-card";
import { MfaSettingsCard } from "@/components/admin/settings/mfa-settings-card";
import { ManageBranches } from "@/components/admin/settings/manage-branches";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { cn } from "@/lib/utils";
import type { Restaurant } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Local layout probe for Settings blank-gap investigation.
 * ?layout=broken — matches currently deployed AdminLayoutShell (pre-fix)
 * default / ?layout=fixed — proposed fix
 */
const mockRestaurant = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Probe Restaurant",
  slug: "probe",
  branch_name: null,
  owner_id: null,
  logo_url: null,
  address: "Test",
  phone: "0610000000",
  takeaway_hotline: null,
  payment_mode: "ussd",
  subscription_tier: "pro",
  subscription_status: "active",
  subscription_end_date: new Date(Date.now() + 86400000 * 30).toISOString(),
  evc_ussd_code: "*712#",
  edahab_ussd_code: "*888#",
  dine_in_enabled: true,
  takeaway_enabled: true,
  billing_model_dinein: "pay_before",
  billing_model_takeaway: "pay_before",
  brand_color: "#C45C26",
  custom_branding_enabled: false,
  is_active: true,
  is_demo: false,
  demo_expires_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as Restaurant;

export default function SettingsProbePage({
  searchParams,
}: {
  searchParams?: { layout?: string };
}) {
  if (process.env.NODE_ENV === "production") {
    return <p className="p-8">Probe disabled in production.</p>;
  }

  const broken = searchParams?.layout === "broken";

  return (
    <AdminBrandProvider brandColor={mockRestaurant.brand_color}>
      <div
        data-layout-mode={broken ? "broken" : "fixed"}
        className={cn(
          "flex min-h-screen w-full max-w-[100vw] bg-[#F8FAFC]",
          broken ? "overflow-x-hidden" : "overflow-x-clip"
        )}
      >
        {/* Deployed: stretches under align-items:stretch. Fixed: h-0 self-start width reserve only. */}
        <div
          data-testid="sidebar-spacer"
          className={cn(
            "hidden shrink-0 md:block",
            broken ? "w-64" : "h-0 w-64 self-start"
          )}
          aria-hidden="true"
        />
        <div
          className={cn(
            "flex min-h-screen min-w-0 flex-1 flex-col",
            broken ? "overflow-x-hidden" : "overflow-x-clip"
          )}
        >
          <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-white px-6">
            Settings layout probe ({broken ? "broken / prod" : "fixed"})
          </header>
          <main
            id="probe-main"
            className={cn(
              "app-light-surface relative z-0 flex min-w-0 w-full flex-1 flex-col text-[#0F172A]",
              broken ? "overflow-x-hidden" : "overflow-x-clip"
            )}
          >
            <div id="probe-content" className="mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6">
              <div id="probe-settings-root" className="w-full min-w-0 space-y-4 sm:space-y-5">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold">Settings</h1>
                  <p className="text-muted-foreground">
                    Probe page for gap measurement — scroll Restaurant Details → Payment Rules
                  </p>
                </div>
                <div data-probe-section="branches">
                  <ManageBranches
                    branches={[
                      {
                        id: mockRestaurant.id,
                        name: "Probe",
                        slug: "probe",
                        branch_name: null,
                        address: "Test",
                      },
                    ]}
                    currentSlug="probe"
                    subscriptionTier="pro"
                  />
                </div>
                <div data-probe-section="mfa">
                  <MfaSettingsCard />
                </div>
                <div data-probe-section="settings-form">
                  <SettingsForm restaurant={mockRestaurant} />
                </div>
                <div data-probe-section="loyalty">
                  <LoyaltySettingsCard
                    slug="probe"
                    restaurantId={mockRestaurant.id}
                    initialSettings={null}
                    initialStats={{
                      customers_with_progress: 0,
                      customers_with_rewards: 0,
                      total_redemptions: 0,
                    }}
                  />
                </div>
                <div data-probe-section="whatsapp">
                  <WhatsAppSettingsCard
                    slug="probe"
                    initialSettings={{
                      order_ready_enabled: false,
                      reengagement_enabled: false,
                      reengagement_idle_days: 14,
                      reengagement_min_interval_days: 21,
                    }}
                    initialUsage={{
                      month_utility_messages: 0,
                      month_marketing_messages: 0,
                      month_estimated_cost_usd: 0,
                      utility_unit_cost_usd: 0.005,
                      marketing_unit_cost_usd: 0.025,
                    }}
                    initialMeta={{
                      dry_run: true,
                      twilio_configured: false,
                      templates_configured: false,
                      reengagement_allowed: true,
                    }}
                  />
                </div>
              </div>
            </div>
            <PoweredByHilaac
              className={cn("pb-4 pt-2 sm:pb-6", broken && "mt-auto")}
            />
          </main>
        </div>
      </div>
    </AdminBrandProvider>
  );
}
