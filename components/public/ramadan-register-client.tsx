"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import type { RamadanPackage } from "@/types/database";

export function PublicRamadanClient({
  slug,
  restaurantName,
  packages,
}: {
  slug: string;
  restaurantName: string;
  packages: RamadanPackage[];
}) {
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [passCode, setPassCode] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setPassCode(null);
    try {
      const res = await fetch("/api/public/ramadan/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          package_id: packageId,
          customer_name: customerName,
          customer_phone: customerPhone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      setPassCode(data.subscription?.pass_code ?? null);
      toast.success("Registered — save your pass code");
      setCustomerName("");
      setCustomerPhone("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSaving(false);
    }
  }

  if (packages.length === 0) {
    return (
      <p className="text-sm text-slate-600">No active packages are available right now.</p>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-10">
      <header>
        <p className="text-sm font-medium text-slate-500">{restaurantName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Season packages
        </h1>
        <p className="mt-1 text-sm text-slate-600">Choose a package and register for your pass.</p>
      </header>

      <ul className="space-y-3">
        {packages.map((pkg) => (
          <li key={pkg.id}>
            <button
              type="button"
              onClick={() => setPackageId(pkg.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                packageId === pkg.id
                  ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{pkg.name}</p>
                  <p className="text-xs capitalize text-slate-500">
                    {pkg.type}
                    {pkg.meal_type ? ` · ${pkg.meal_type}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">{formatCurrency(Number(pkg.price))}</p>
              </div>
              {pkg.description ? (
                <p className="mt-1 text-sm text-slate-600">{pkg.description}</p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="ramadan-name">Your name</Label>
          <Input
            id="ramadan-name"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ramadan-phone">Phone</Label>
          <Input
            id="ramadan-phone"
            type="tel"
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={saving || !packageId} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Register
        </Button>
      </form>

      {passCode ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
            Your pass code
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-emerald-950">
            {passCode}
          </p>
          <p className="mt-1 text-xs text-emerald-800">Show this at the restaurant for check-in.</p>
        </div>
      ) : null}
    </div>
  );
}
