import { redirect } from "next/navigation";

/** Consolidated under Staff → Dashboard Access. Keep URL for old bookmarks. */
export default function StaffAccessPage({ params }: { params: { slug: string } }) {
  redirect(`/admin/${params.slug}/staff?tab=access`);
}
