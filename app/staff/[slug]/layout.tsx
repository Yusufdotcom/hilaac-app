/**
 * Pass-through layout for /staff/[slug]/*.
 * Auth + shell live in (floor)/layout so /pin stays public.
 */
export default function StaffSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
