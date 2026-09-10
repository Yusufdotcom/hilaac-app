import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { StaffPinPadWithParams } from "@/components/staff/staff-pin-pad";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StaffPinPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, slug, is_active")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!restaurant || restaurant.is_active === false) notFound();

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <Suspense fallback={<p className="p-8 text-center text-sm text-slate-500">Loading…</p>}>
        <StaffPinPadWithParams slug={restaurant.slug} restaurantName={restaurant.name} />
      </Suspense>
    </div>
  );
}
