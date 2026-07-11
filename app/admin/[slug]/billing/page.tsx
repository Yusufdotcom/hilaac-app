import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { BillingView } from "@/components/admin/billing/billing-view";

export default async function BillingPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription plan and payment.</p>
      </div>
      <BillingView restaurant={restaurant} />
    </div>
  );
}
