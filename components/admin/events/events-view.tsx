"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export type BookingRow = {
  id: string;
  event_type: string;
  event_name: string | null;
  contact_name: string;
  contact_phone: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  guest_count: number | null;
  status: string;
  total_price: number | null;
  deposit_paid: number;
  balance_due_date: string | null;
  estimated_cost: number | null;
  notes: string | null;
  space?: { id: string; name: string } | null;
};

const STATUS_DOT: Record<string, string> = {
  inquiry: "bg-slate-400",
  confirmed: "bg-emerald-500",
  cancelled: "bg-red-500",
  completed: "bg-sky-500",
};

const STATUS_BADGE: Record<string, string> = {
  inquiry: "bg-slate-100 text-slate-700",
  confirmed: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-red-50 text-red-700",
  completed: "bg-sky-50 text-sky-800",
};

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function EventsView({
  slug,
  bookings: initialBookings,
  gated,
  canShowPl,
}: {
  slug: string;
  bookings: BookingRow[];
  gated?: boolean;
  canShowPl?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bookings, setBookings] = useState(initialBookings);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costDraft, setCostDraft] = useState("");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);

  const byDate = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      const list = map.get(b.event_date) ?? [];
      list.push(b);
      map.set(b.event_date, list);
    }
    return map;
  }, [bookings]);

  const selected = bookings.find((b) => b.id === selectedId) ?? null;
  const dayBookings = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  async function patchBooking(id: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/admin/events/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      booking?: BookingRow;
    };
    if (!res.ok) {
      setError(json.error || "Update failed");
      return null;
    }
    if (json.booking) {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...json.booking! } : b)));
    }
    startTransition(() => router.refresh());
    return json.booking ?? null;
  }

  async function sendReminder(id: string) {
    setError(null);
    const res = await fetch("/api/admin/events/remind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
    if (!res.ok) {
      setError(json.error || "Reminder failed");
      return;
    }
  }

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

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const revenue = selected?.total_price != null ? Number(selected.total_price) : 0;
  const deposit = Number(selected?.deposit_paid ?? 0);
  const balance = Math.max(0, revenue - deposit);
  const estimated =
    selected?.estimated_cost != null
      ? Number(selected.estimated_cost)
      : selected?.guest_count != null
        ? Number(selected.guest_count) * 15
        : revenue > 0
          ? Math.round(revenue * 0.4)
          : 0;
  const profit = revenue - estimated;

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

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-slate-100"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
              {monthLabel(cursor)}
            </h2>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-slate-100"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted,#64748B)]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day == null) {
                return <div key={`e-${idx}`} className="min-h-[72px] rounded-lg bg-slate-50/50" />;
              }
              const key = toDateKey(year, month, day);
              const list = byDate.get(key) ?? [];
              const active = selectedDate === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedDate(key);
                    setSelectedId(list[0]?.id ?? null);
                    if (list[0]?.estimated_cost != null) {
                      setCostDraft(String(list[0].estimated_cost));
                    } else {
                      setCostDraft("");
                    }
                  }}
                  className={`min-h-[72px] rounded-lg border px-1.5 py-1.5 text-left transition ${
                    active
                      ? "border-[var(--admin-brand,#9E2E2E)] bg-[#9E2E2E]/5"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xs font-semibold text-[var(--admin-text,#0F172A)]">
                    {day}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {list.slice(0, 4).map((b) => (
                      <span
                        key={b.id}
                        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[b.status] ?? "bg-slate-300"}`}
                        title={`${b.event_name || b.event_type} (${b.status})`}
                      />
                    ))}
                  </div>
                  {list.length > 0 ? (
                    <p className="mt-1 truncate text-[10px] text-[var(--admin-muted,#64748B)]">
                      {list.length} booking{list.length === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--admin-muted,#64748B)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> Inquiry
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Confirmed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Cancelled
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Completed
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
              {selectedDate ? `Bookings on ${selectedDate}` : "Select a date"}
            </h3>
            {!selectedDate ? (
              <p className="mt-2 text-sm text-[var(--admin-muted,#64748B)]">
                Click a day on the calendar to review bookings.
              </p>
            ) : dayBookings.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--admin-muted,#64748B)]">No bookings this day.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dayBookings.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(b.id);
                        setCostDraft(
                          b.estimated_cost != null ? String(b.estimated_cost) : ""
                        );
                      }}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        selectedId === b.id
                          ? "border-[var(--admin-brand,#9E2E2E)] bg-[#9E2E2E]/5"
                          : "border-[var(--admin-border,#E2E8F0)] hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium capitalize text-[var(--admin-text,#0F172A)]">
                          {b.event_name || b.event_type}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            STATUS_BADGE[b.status] ?? "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--admin-muted,#64748B)]">
                        {b.contact_name} · {b.space?.name ?? "No space"}
                        {b.guest_count != null ? ` · ${b.guest_count} guests` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected ? (
            <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4 sm:p-5">
              <h3 className="text-sm font-semibold capitalize text-[var(--admin-text,#0F172A)]">
                {selected.event_name || selected.event_type}
              </h3>
              <dl className="mt-3 space-y-1.5 text-sm text-[var(--admin-muted,#64748B)]">
                <div>
                  Contact:{" "}
                  <span className="text-[var(--admin-text,#0F172A)]">
                    {selected.contact_name} · {selected.contact_phone}
                  </span>
                </div>
                <div>
                  Space:{" "}
                  <span className="text-[var(--admin-text,#0F172A)]">
                    {selected.space?.name ?? "—"}
                  </span>
                </div>
                <div>
                  Time:{" "}
                  <span className="text-[var(--admin-text,#0F172A)]">
                    {selected.start_time
                      ? String(selected.start_time).slice(0, 5)
                      : "—"}
                    {selected.end_time
                      ? `–${String(selected.end_time).slice(0, 5)}`
                      : ""}
                  </span>
                </div>
                {selected.notes ? (
                  <div>
                    Notes:{" "}
                    <span className="text-[var(--admin-text,#0F172A)]">{selected.notes}</span>
                  </div>
                ) : null}
              </dl>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase text-[var(--admin-muted,#64748B)]">Total</p>
                  <p className="font-semibold tabular-nums">
                    {selected.total_price != null
                      ? formatCurrency(Number(selected.total_price))
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase text-[var(--admin-muted,#64748B)]">Deposit</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(deposit)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase text-[var(--admin-muted,#64748B)]">Balance</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(balance)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase text-[var(--admin-muted,#64748B)]">Due</p>
                  <p className="font-semibold">{selected.balance_due_date ?? "—"}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selected.status === "inquiry" ? (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => void patchBooking(selected.id, { status: "confirmed" })}
                  >
                    Confirm
                  </Button>
                ) : null}
                {selected.status === "confirmed" ? (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => void patchBooking(selected.id, { status: "completed" })}
                  >
                    Mark completed
                  </Button>
                ) : null}
                {selected.status !== "cancelled" && selected.status !== "completed" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => void patchBooking(selected.id, { status: "cancelled" })}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => void sendReminder(selected.id)}
                >
                  Send reminder
                </Button>
              </div>

              {canShowPl && (selected.status === "completed" || revenue > 0) ? (
                <div className="mt-5 rounded-xl border border-[var(--admin-border,#E2E8F0)] bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted,#64748B)]">
                    Event P&amp;L
                  </p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt>Revenue</dt>
                      <dd className="font-semibold tabular-nums">{formatCurrency(revenue)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Estimated cost</dt>
                      <dd className="font-semibold tabular-nums">{formatCurrency(estimated)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-[var(--admin-border,#E2E8F0)] pt-2">
                      <dt>Profit</dt>
                      <dd
                        className={`font-bold tabular-nums ${
                          profit >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(profit)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="block text-xs text-[var(--admin-muted,#64748B)]">
                      Set estimated cost
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={costDraft}
                        onChange={(e) => setCostDraft(e.target.value)}
                        className="mt-1 block w-36 rounded-md border border-[var(--admin-border,#E2E8F0)] bg-white px-2 py-1.5 text-sm text-[var(--admin-text,#0F172A)]"
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || costDraft === ""}
                      onClick={() =>
                        void patchBooking(selected.id, {
                          estimated_cost: Number(costDraft),
                        })
                      }
                    >
                      Save cost
                    </Button>
                  </div>
                  {selected.estimated_cost == null ? (
                    <p className="mt-2 text-[11px] text-[var(--admin-muted,#64748B)]">
                      Using a rough estimate until you save a cost.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
