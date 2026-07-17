import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";

export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  await getRestaurantContext(params.slug);

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      <main className="app-light-surface min-h-screen w-full text-[#0F172A]">{children}</main>
    </div>
  );
}
