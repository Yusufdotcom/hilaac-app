import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { StaffAccessBoard } from "@/components/admin/staff-access/staff-access-board";
import { getAppUrl } from "@/lib/app-url";

export default async function StaffAccessPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);

  return (
    <StaffAccessBoard
      slug={restaurant.slug}
      appUrl={getAppUrl()}
      restaurantName={restaurant.name}
    />
  );
}
