import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderConfirmation } from "@/components/order/order-confirmation";

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { orderId?: string };
}) {
  const orderId = searchParams.orderId;
  if (!orderId) notFound();

  const supabase = createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, is_active")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!restaurant || !restaurant.is_active) notFound();

  return (
    <OrderConfirmation
      orderId={orderId}
      restaurant={{ name: restaurant.name }}
      newOrderHref={`/order/${restaurant.slug}`}
    />
  );
}
