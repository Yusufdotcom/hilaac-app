"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { BrandButton } from "@/components/admin/brand-button";
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
import { formatCurrency } from "@/lib/utils";
import type { RamadanPackage } from "@/types/database";

export function PackagesView({
  slug,
  packages,
  gated,
  needsSeason,
  activeSeason,
}: {
  slug: string;
  packages: RamadanPackage[];
  gated?: boolean;
  needsSeason?: boolean;
  activeSeason?: "ramadan" | "eid" | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "normal" as "normal" | "buffet",
    price: "",
    description: "",
    valid_from: "",
    valid_to: "",
    meal_type: "both" as "iftar" | "suhoor" | "both" | "",
    buffet_start_time: "",
    buffet_end_time: "",
    max_daily_capacity: "",
  });

  if (gated) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
          Somali Airlines 1.0 feature
        </p>
        <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
          Upgrade to manage Ramadan and Eid packages.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={`/admin/${slug}/billing`}>View billing</Link>
        </Button>
      </div>
    );
  }

  if (needsSeason) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
          Enable a season mode first
        </p>
        <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
          Turn on Ramadan or Eid Mode in Settings before creating packages.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={`/admin/${slug}/settings`}>Open Settings</Link>
        </Button>
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          price: Number(form.price),
          description: form.description || null,
          valid_from: form.valid_from,
          valid_to: form.valid_to,
          meal_type: form.meal_type || null,
          season: activeSeason,
          buffet_start_time: form.type === "buffet" ? form.buffet_start_time || null : null,
          buffet_end_time: form.type === "buffet" ? form.buffet_end_time || null : null,
          max_daily_capacity:
            form.type === "buffet" && form.max_daily_capacity
              ? Number(form.max_daily_capacity)
              : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create package");
      toast.success("Package created");
      setForm({
        name: "",
        type: "normal",
        price: "",
        description: "",
        valid_from: "",
        valid_to: "",
        meal_type: "both",
        buffet_start_time: "",
        buffet_end_time: "",
        max_daily_capacity: "",
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create package");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageIntro>
        Manage {activeSeason === "eid" ? "Eid" : "Ramadan"} packages. Public registration:{" "}
        <Link className="underline" href={`/r/${slug}/ramadan`}>
          /r/{slug}/ramadan
        </Link>
      </AdminPageIntro>

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4 sm:p-5"
      >
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">Create package</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pkg-name">Name</Label>
            <Input
              id="pkg-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, type: v === "buffet" ? "buffet" : "normal" }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="buffet">Buffet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-price">Price</Label>
            <Input
              id="pkg-price"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Meal type</Label>
            <Select
              value={form.meal_type || "both"}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  meal_type: v as "iftar" | "suhoor" | "both",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="iftar">Iftar</SelectItem>
                <SelectItem value="suhoor">Suhoor</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-from">Valid from</Label>
            <Input
              id="pkg-from"
              type="date"
              required
              value={form.valid_from}
              onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-to">Valid to</Label>
            <Input
              id="pkg-to"
              type="date"
              required
              value={form.valid_to}
              onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))}
            />
          </div>
        </div>
        {form.type === "buffet" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="buffet-start">Buffet start</Label>
              <Input
                id="buffet-start"
                type="time"
                value={form.buffet_start_time}
                onChange={(e) => setForm((f) => ({ ...f, buffet_start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buffet-end">Buffet end</Label>
              <Input
                id="buffet-end"
                type="time"
                value={form.buffet_end_time}
                onChange={(e) => setForm((f) => ({ ...f, buffet_end_time: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buffet-cap">Max daily capacity</Label>
              <Input
                id="buffet-cap"
                type="number"
                min={1}
                value={form.max_daily_capacity}
                onChange={(e) => setForm((f) => ({ ...f, max_daily_capacity: e.target.value }))}
              />
            </div>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="pkg-desc">Description</Label>
          <Input
            id="pkg-desc"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <BrandButton type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create package
        </BrandButton>
      </form>

      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[var(--admin-bg,#F8FAFC)] text-left text-[var(--admin-muted,#64748B)]">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Valid</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {packages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--admin-muted,#64748B)]">
                  No packages yet.
                </td>
              </tr>
            ) : (
              packages.map((pkg) => (
                <tr key={pkg.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--admin-text,#0F172A)]">
                    {pkg.name}
                  </td>
                  <td className="px-4 py-3 capitalize">{pkg.type}</td>
                  <td className="px-4 py-3">{formatCurrency(Number(pkg.price))}</td>
                  <td className="px-4 py-3 text-[var(--admin-muted,#64748B)]">
                    {pkg.valid_from} → {pkg.valid_to}
                  </td>
                  <td className="px-4 py-3">{pkg.is_active ? "Active" : "Off"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
