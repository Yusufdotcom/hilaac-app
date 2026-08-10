import Link from "next/link";
import { ShoppingBag, DollarSign, Table2, Clock, CreditCard, Gift, Crown, Star } from "lucide-react";
import { AdminBrandProvider } from "@/components/admin/admin-brand-context";
import { BrandButton } from "@/components/admin/brand-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  adminBrandCalloutClass,
  adminBrandIconWellClass,
  adminBrandSolidButtonClass,
  adminBrandTextClass,
} from "@/lib/brand/admin-tokens";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BRAND = "#9E2E2E"; // Baba's live brand_color

export default function AdminAccentProbePage() {
  if (process.env.NODE_ENV === "production") {
    return <p className="p-8">Probe disabled in production.</p>;
  }

  const stats = [
    { label: "Orders Today", value: "12", icon: ShoppingBag },
    { label: "Revenue Today", value: "$240", icon: DollarSign },
    { label: "Active Tables", value: "5", icon: Table2 },
    { label: "Open Orders", value: "3", icon: Clock },
  ];

  return (
    <AdminBrandProvider brandColor={BRAND}>
      <div className="min-h-screen space-y-10 bg-[#F8FAFC] p-6 text-[#0F172A]">
        <header>
          <p className="text-xs text-muted-foreground">
            Admin accent probe — brand_color {BRAND} (Baba&apos;s live value)
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Admin brand audit surfaces</h1>
        </header>

        <section className="space-y-3" data-probe="dashboard">
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <div
            className={cn(
              "flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
              adminBrandCalloutClass
            )}
          >
            <div className="flex items-start gap-3">
              <CreditCard className={cn("mt-0.5 h-5 w-5", adminBrandTextClass)} />
              <div>
                <p className="font-semibold text-[#0F172A]">3 orders awaiting payment confirmation</p>
                <p className="text-[#334155]">Brand-tinted banner (was amber)</p>
              </div>
            </div>
            <Link
              href="#"
              className={cn(
                "rounded-lg px-3 py-2 text-center text-sm font-semibold",
                adminBrandSolidButtonClass
              )}
            >
              Review orders
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full",
                      adminBrandIconWellClass
                    )}
                  >
                    <stat.icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3" data-probe="menu">
          <h2 className="text-lg font-semibold">Menu prices</h2>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">Grilled Chicken</p>
                <p className="text-xs text-muted-foreground">Mains</p>
              </div>
              <p className={cn("font-bold", adminBrandTextClass)}>$12.50</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <span className="font-medium">Extra cheese</span>
              <span className={cn("font-bold", adminBrandTextClass)}>$1.50</span>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3" data-probe="orders">
          <h2 className="text-lg font-semibold">Orders (semantic badges — keep)</h2>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-0 bg-orange-100 text-orange-900">awaiting payment</Badge>
            <Badge className="border-0 bg-amber-100 text-amber-900">preparing</Badge>
            <Badge className="border-0 bg-emerald-100 text-emerald-900">paid</Badge>
            <Badge className="border-0 bg-red-100 text-red-800">cancelled</Badge>
          </div>
          <BrandButton>Brand action</BrandButton>
        </section>

        <section className="space-y-3" data-probe="tables">
          <h2 className="text-lg font-semibold">Tables</h2>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">Table 4</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <BrandButton size="sm">QR</BrandButton>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3" data-probe="reports">
          <h2 className="text-lg font-semibold">Reports</h2>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", adminBrandIconWellClass)}>
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Chart accent</p>
                <p className={cn("text-xl font-bold", adminBrandTextClass)}>$1,240</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3" data-probe="staff">
          <h2 className="text-lg font-semibold">Staff</h2>
          <p className="text-sm text-muted-foreground">
            Tabs: Accounts · Dashboard Access · Waiter Names — CTAs use BrandButton
          </p>
          <BrandButton>Copy kitchen link</BrandButton>
        </section>

        <section className="space-y-3" data-probe="billing">
          <h2 className="text-lg font-semibold">Billing</h2>
          <Card className={cn("border-2", "border-[color:var(--admin-brand)]")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                Pro <Crown className={cn("h-5 w-5", adminBrandTextClass)} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BrandButton>Manage</BrandButton>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3" data-probe="settings">
          <h2 className="text-lg font-semibold">Settings</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gift className={cn("h-5 w-5", adminBrandTextClass)} /> Loyalty
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BrandButton>Save</BrandButton>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Semantic warning callout (WhatsApp dry-run style) — keep amber
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3" data-probe="misc">
          <h2 className="text-lg font-semibold">Top-pick star (now brand)</h2>
          <Star className={cn("h-6 w-6 fill-current", adminBrandTextClass)} />
        </section>
      </div>
    </AdminBrandProvider>
  );
}
