import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export type TodaysEventRow = {
  id: string;
  event_type: string;
  event_name: string | null;
  contact_name: string;
  guest_count: number | null;
  start_time: string | null;
  status: string;
  total_price: number | null;
  space_name: string | null;
};

export function TodaysEventsCard({
  slug,
  events,
}: {
  slug: string;
  events: TodaysEventRow[];
}) {
  if (events.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--admin-muted,#64748B)]">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Today&apos;s events
          </p>
          <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
            {events.length} confirmed or inquiry event{events.length === 1 ? "" : "s"} today
          </p>
        </div>
        <Link
          href={`/admin/${slug}/events`}
          className="text-xs font-semibold text-[var(--admin-brand,#9E2E2E)] hover:underline"
        >
          Events →
        </Link>
      </div>

      <ul className="mt-4 space-y-3">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-[var(--admin-border,#E2E8F0)] px-3 py-2.5"
          >
            <div>
              <p className="font-semibold text-[var(--admin-text,#0F172A)] capitalize">
                {ev.event_name || ev.event_type}
                {ev.start_time ? (
                  <span className="ml-2 text-sm font-normal text-[var(--admin-muted,#64748B)]">
                    {String(ev.start_time).slice(0, 5)}
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-[var(--admin-muted,#64748B)]">
                {ev.contact_name}
                {ev.space_name ? ` · ${ev.space_name}` : ""}
                {ev.guest_count != null ? ` · ${ev.guest_count} guests` : ""}
                {" · "}
                <span className="capitalize">{ev.status}</span>
              </p>
            </div>
            {ev.total_price != null ? (
              <p className="text-sm font-semibold tabular-nums text-[var(--admin-text,#0F172A)]">
                {formatCurrency(Number(ev.total_price))}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
