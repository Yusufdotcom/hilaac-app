"use client";

import Link from "next/link";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type BookingRow = {
  id: string;
  event_type: string;
  event_name: string | null;
  contact_name: string;
  contact_phone: string;
  event_date: string;
  guest_count: number | null;
  status: string;
  total_price: number | null;
  space?: { id: string; name: string } | null;
};

export function EventsView({
  slug,
  bookings,
  gated,
}: {
  slug: string;
  bookings: BookingRow[];
  gated?: boolean;
}) {
  if (gated) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
          Somali Airlines 1.0 feature
        </p>
        <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
          Upgrade for wedding &amp; event hall management.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={`/admin/${slug}/billing`}>View billing</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminPageIntro>
          Event bookings and inquiries. Public reserve link:{" "}
          <Link className="underline" href={`/r/${slug}/reserve`}>
            /r/{slug}/reserve
          </Link>
        </AdminPageIntro>
        <Button asChild variant="outline">
          <Link href={`/admin/${slug}/events/spaces`}>Manage spaces</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-[var(--admin-bg,#F8FAFC)] text-left text-[var(--admin-muted,#64748B)]">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Space</th>
              <th className="px-4 py-3 font-semibold">Guests</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Price</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--admin-muted,#64748B)]">
                  No bookings yet.
                </td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{b.event_date}</td>
                  <td className="px-4 py-3 capitalize">
                    {b.event_name || b.event_type}
                  </td>
                  <td className="px-4 py-3">
                    <div>{b.contact_name}</div>
                    <div className="text-xs text-[var(--admin-muted,#64748B)]">{b.contact_phone}</div>
                  </td>
                  <td className="px-4 py-3">{b.space?.name ?? "—"}</td>
                  <td className="px-4 py-3">{b.guest_count ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{b.status}</td>
                  <td className="px-4 py-3">
                    {b.total_price != null ? formatCurrency(Number(b.total_price)) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
