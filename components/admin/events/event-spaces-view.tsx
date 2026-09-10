"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { EventSpace } from "@/types/database";

export function EventSpacesView({
  slug,
  spaces,
  gated,
}: {
  slug: string;
  spaces: EventSpace[];
  gated?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    capacity: "",
    description: "",
    price_per_event: "",
  });

  if (gated) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold">Somali Airlines 1.0 feature</p>
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/events/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          capacity: form.capacity ? Number(form.capacity) : null,
          description: form.description || null,
          price_per_event: form.price_per_event ? Number(form.price_per_event) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create space");
      toast.success("Space created");
      setForm({ name: "", capacity: "", description: "", price_per_event: "" });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create space");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(space: EventSpace, is_active: boolean) {
    const { error } = await supabase
      .from("event_spaces")
      .update({ is_active })
      .eq("id", space.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.refresh();
  }

  async function removeSpace(space: EventSpace) {
    if (!window.confirm(`Delete space “${space.name}”?`)) return;
    const { error } = await supabase.from("event_spaces").delete().eq("id", space.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Space deleted");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminPageIntro>Halls and event spaces for bookings.</AdminPageIntro>
        <Button asChild variant="outline">
          <Link href={`/admin/${slug}/events`}>Back to bookings</Link>
        </Button>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4 sm:p-5"
      >
        <p className="text-sm font-semibold">Add space</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="space-cap">Capacity</Label>
            <Input
              id="space-cap"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="space-price">Price per event</Label>
            <Input
              id="space-price"
              type="number"
              min={0}
              step="0.01"
              value={form.price_per_event}
              onChange={(e) => setForm((f) => ({ ...f, price_per_event: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="space-desc">Description</Label>
            <Input
              id="space-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>
        <BrandButton type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Add space
        </BrandButton>
      </form>

      <ul className="space-y-3">
        {spaces.length === 0 ? (
          <li className="rounded-2xl border px-4 py-8 text-center text-sm text-[var(--admin-muted,#64748B)]">
            No spaces yet.
          </li>
        ) : (
          spaces.map((space) => (
            <li
              key={space.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-4 py-3"
            >
              <div>
                <p className="font-medium text-[var(--admin-text,#0F172A)]">{space.name}</p>
                <p className="text-xs text-[var(--admin-muted,#64748B)]">
                  {space.capacity != null ? `${space.capacity} guests` : "Capacity —"}
                  {space.price_per_event != null
                    ? ` · ${formatCurrency(Number(space.price_per_event))}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--admin-muted,#64748B)]">Active</span>
                  <Switch
                    checked={space.is_active}
                    onCheckedChange={(on) => toggleActive(space, on)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSpace(space)}
                  aria-label={`Delete ${space.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
