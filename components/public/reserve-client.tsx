"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventSpace, EventType } from "@/types/database";

const EVENT_TYPES: EventType[] = [
  "wedding",
  "graduation",
  "corporate",
  "birthday",
  "meeting",
  "other",
];

export function PublicReserveClient({
  slug,
  restaurantName,
  spaces,
}: {
  slug: string;
  restaurantName: string;
  spaces: EventSpace[];
}) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    contact_name: "",
    contact_phone: "",
    event_date: "",
    event_type: "wedding" as EventType,
    event_name: "",
    guest_count: "",
    space_id: "",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/public/events/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          contact_name: form.contact_name,
          contact_phone: form.contact_phone,
          event_date: form.event_date,
          event_type: form.event_type,
          event_name: form.event_name || null,
          guest_count: form.guest_count ? Number(form.guest_count) : null,
          space_id: form.space_id || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not submit inquiry");
      setDone(true);
      toast.success("Inquiry sent — we will contact you soon");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit inquiry");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Inquiry received</h1>
        <p className="mt-2 text-sm text-slate-600">
          {restaurantName} will follow up on your event request.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <header>
        <p className="text-sm font-medium text-slate-500">{restaurantName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Book an event
        </h1>
        <p className="mt-1 text-sm text-slate-600">Send an inquiry — no payment required.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="res-name">Your name</Label>
            <Input
              id="res-name"
              required
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-phone">Phone</Label>
            <Input
              id="res-phone"
              type="tel"
              required
              value={form.contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="res-date">Event date</Label>
            <Input
              id="res-date"
              type="date"
              required
              value={form.event_date}
              onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Event type</Label>
            <Select
              value={form.event_type}
              onValueChange={(v) => setForm((f) => ({ ...f, event_type: v as EventType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {spaces.length > 0 ? (
          <div className="space-y-1.5">
            <Label>Preferred space (optional)</Label>
            <Select
              value={form.space_id || "none"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, space_id: v === "none" ? "" : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any / not sure</SelectItem>
                {spaces.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.capacity != null ? ` (${s.capacity})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="res-event-name">Event name</Label>
            <Input
              id="res-event-name"
              value={form.event_name}
              onChange={(e) => setForm((f) => ({ ...f, event_name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-guests">Guest count</Label>
            <Input
              id="res-guests"
              type="number"
              min={1}
              value={form.guest_count}
              onChange={(e) => setForm((f) => ({ ...f, guest_count: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="res-notes">Notes</Label>
          <Input
            id="res-notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit inquiry
        </Button>
      </form>
    </div>
  );
}
