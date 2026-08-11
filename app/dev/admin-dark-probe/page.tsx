"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { useAdminAppearance } from "@/components/admin/admin-appearance-context";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { DashboardStatCard } from "@/components/admin/dashboard/dashboard-stat-card";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { KpiCards } from "@/components/admin/reports/kpi-cards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, DollarSign, UtensilsCrossed } from "lucide-react";
import type { Restaurant } from "@/types/database";
import type { KpiSummary } from "@/lib/reports/types";

const mockRestaurant = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Baba's Grill and Cafe",
  slug: "baba-s-grill-and-cafe",
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
  billing_model_dinein: "pay_after",
  billing_model_takeaway: "pay_before",
  brand_color: "#9E2E2E",
  custom_branding_enabled: true,
  is_active: true,
  is_demo: false,
  demo_expires_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as Restaurant;

const mockKpi: KpiSummary = {
  total_orders: 42,
  total_revenue: 1280,
  avg_order_value: 30.48,
  top_item_name: "Shawarma",
  top_item_quantity: 18,
  items_sold: 96,
  trends: {
    orders: {
      direction: "up",
      percent: 12,
      insufficientData: false,
      current: 42,
      previous: 37,
    },
    revenue: {
      direction: "up",
      percent: 8,
      insufficientData: false,
      current: 1280,
      previous: 1180,
    },
    aov: {
      direction: "flat",
      percent: 0,
      insufficientData: false,
      current: 30.48,
      previous: 30,
    },
  },
};

function ForceDark({ children }: { children: React.ReactNode }) {
  const { setTheme } = useAdminAppearance();
  useEffect(() => {
    setTheme("dark");
  }, [setTheme]);
  return <>{children}</>;
}

function PageBody({ page }: { page: string }) {
  if (page === "dashboard") {
    return (
      <div data-probe-page="dashboard" className="space-y-5">
        <AdminPageIntro>Overview of today&apos;s performance.</AdminPageIntro>
        <div className="grid gap-4 sm:grid-cols-3">
          <DashboardStatCard label="Orders today" value="18" icon={ShoppingBag} delta={12} />
          <DashboardStatCard label="Revenue today" value="$420" icon={DollarSign} delta={8} />
          <DashboardStatCard label="Avg ticket" value="$23" icon={UtensilsCrossed} delta={null} />
        </div>
        <Card className="w-full overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Today&apos;s Orders</CardTitle>
            <CardDescription>Live feed — dark surface check</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="font-semibold">#274</span>
              <Badge variant="secondary">preparing</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="font-semibold">#273</span>
              <Badge variant="secondary">new</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (page === "reports") {
    return (
      <div data-probe-page="reports" className="space-y-5">
        <AdminPageIntro>Analytics for this period.</AdminPageIntro>
        <KpiCards kpi={mockKpi} animateEntrance={false} />
        <article className="admin-surface rounded-xl border p-5 shadow-sm">
          <h3 className="text-base font-semibold">Revenue chart card</h3>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">Shared admin-surface token</p>
          <div className="mt-4 h-40 rounded-lg bg-[var(--admin-subtle)]" />
        </article>
      </div>
    );
  }

  if (page === "menu") {
    return (
      <div data-probe-page="menu" className="space-y-5">
        <AdminPageIntro>Categories, add-ons, and items.</AdminPageIntro>
        <Tabs defaultValue="categories">
          <TabsList className="admin-surface border">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="addons">Add-ons</TabsTrigger>
            <TabsTrigger value="items">Menu Items</TabsTrigger>
          </TabsList>
          <TabsContent value="categories" className="mt-4">
            <Card className="w-full overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Categories</CardTitle>
                <CardDescription>List card surface</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="rounded-lg border p-3 font-medium">Mains</div>
                <div className="rounded-lg border p-3 font-medium">Drinks</div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (page === "tables") {
    return (
      <div data-probe-page="tables" className="space-y-5">
        <AdminPageIntro>QR tables.</AdminPageIntro>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="admin-glass-hover overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Table QR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border bg-white p-4 text-center text-xs text-black">
                QR stays white
              </div>
            </CardContent>
          </Card>
          <Card className="admin-glass-hover overflow-hidden lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Tables</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-3">
              {["1", "2", "3"].map((n) => (
                <div key={n} className="rounded-lg border p-4 text-center font-semibold">
                  Table {n}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (page === "orders") {
    return (
      <div data-probe-page="orders" className="space-y-5">
        <AdminPageIntro>Manage live orders.</AdminPageIntro>
        <Card className="admin-glass-hover w-full overflow-hidden border-[var(--admin-border)]">
          <CardHeader>
            <CardTitle className="text-lg">Active orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[var(--admin-muted)]">
                    <th className="py-2">Order</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-semibold">#274</td>
                    <td className="py-2">Preparing</td>
                    <td className="py-2">Pending cashier</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (page === "staff") {
    return (
      <div data-probe-page="staff" className="space-y-5">
        <AdminPageIntro>Staff access & waiters.</AdminPageIntro>
        <Card className="overflow-hidden border-[var(--admin-border)]">
          <CardHeader>
            <CardTitle className="text-lg">Dashboard Access</CardTitle>
            <CardDescription>Station cards use admin surface tokens</CardDescription>
          </CardHeader>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {["Kitchen", "Cashier"].map((label) => (
            <div
              key={label}
              className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-card)] shadow-sm"
            >
              <div className="bg-[#0F172A] px-6 py-6 text-white">
                <p className="text-lg font-bold">{label}</p>
              </div>
              <div className="p-4 text-sm text-[var(--admin-muted)]">Open station</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page === "billing") {
    return (
      <div data-probe-page="billing" className="space-y-5">
        <AdminPageIntro>Subscription & plans.</AdminPageIntro>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current plan</CardTitle>
            <CardDescription>Pro — renews in 28 days</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Pro</p>
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Starter</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Basic features</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pro</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Full analytics</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // settings default
  return (
    <div data-probe-page="settings" className="space-y-5">
      <AdminPageIntro>Restaurant profile and payment rules.</AdminPageIntro>
      <SettingsForm restaurant={mockRestaurant} />
    </div>
  );
}

function AdminDarkProbeInner() {
  const search = useSearchParams();
  const page = search.get("page") || "dashboard";

  return (
    <AdminLayoutShell
      restaurantName={mockRestaurant.name}
      subscriptionTier="pro"
      brandColor={mockRestaurant.brand_color}
      userName="Probe"
      userRole="owner"
      currentSlug={mockRestaurant.slug}
      branches={[]}
      awaitingOrdersCount={2}
    >
      <ForceDark>
        <PageBody page={page} />
      </ForceDark>
    </AdminLayoutShell>
  );
}

export default function AdminDarkProbePage() {
  if (process.env.NODE_ENV === "production") {
    return <p className="p-8">Probe disabled in production.</p>;
  }

  return (
    <Suspense fallback={<p className="p-8">Loading probe…</p>}>
      <AdminDarkProbeInner />
    </Suspense>
  );
}
