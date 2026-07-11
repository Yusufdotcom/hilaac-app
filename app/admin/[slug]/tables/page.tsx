import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { TableManager } from "@/components/admin/tables/table-manager";

export default async function TablesPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const supabase = createClient();

  const { data: tables } = await supabase
    .from("tables")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("table_number");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hilaac.so";
  const orderUrl = `${appUrl}/order/${restaurant.slug}`;

  return <TableManager restaurantId={restaurant.id} tables={tables ?? []} orderUrl={orderUrl} restaurantName={restaurant.name} />;
}
