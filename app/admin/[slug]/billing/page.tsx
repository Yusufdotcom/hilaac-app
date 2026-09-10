import { Suspense } from "react";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { BillingView } from "@/components/admin/billing/billing-view";

export default async function BillingPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug, ["owner"]);

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      <AdminPageIntro>Manage your subscription plan and payment.</AdminPageIntro>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading billing…</p>}>
        <BillingView restaurant={restaurant} />
      </Suspense>
    </div>
  );
}
