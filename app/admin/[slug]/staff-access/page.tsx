import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { StaffAccessBoard } from "@/components/admin/staff-access/staff-access-board";

export default async function StaffAccessPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hilaac.so";

  return (
    <StaffAccessBoard
      slug={restaurant.slug}
      appUrl={appUrl}
      restaurantName={restaurant.name}
    />
  );
}
