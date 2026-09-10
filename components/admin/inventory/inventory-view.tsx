"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  Package,
  PackageX,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { BrandButton } from "@/components/admin/brand-button";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import { WASTE_NOTE_PREFIX } from "@/lib/inventory/inventory-math";
import type { InventoryPageData } from "@/lib/inventory/fetch-inventory";
import type { InventoryRow } from "@/lib/inventory/inventory-math";

const STATUS_PILL: Record<
  InventoryRow["status"],
  { label: string; className: string }
> = {
  good: {
    label: "Good",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  reorder: {
    label: "⚠️ Reorder",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  },
  out: {
    label: "Out of stock",
    className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  },
};

export function InventoryView({
  restaurantId,
  data,
  gated,
}: {
  restaurantId: string;
  data: InventoryPageData | null;
  gated?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState("inventory");
  const [addOpen, setAddOpen] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    unit: "kg",
    current_stock: "0",
    daily_usage_estimate: "",
    reorder_level: "",
    supplier_delivery_days: "2",
    cost_per_unit: "",
  });
  const [wasteForm, setWasteForm] = useState({
    productName: "",
    amount: "",
    note: "",
  });

  const productNames = useMemo(
    () => (data?.rows ?? []).map((r) => r.name),
    [data?.rows]
  );

  if (gated) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
          Inventory is on Gorgor 1.0 and above
        </p>
        <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
          Upgrade to track stock, smart reorder, and waste.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-[var(--admin-muted,#64748B)]">Could not load inventory.</p>
    );
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("inventory_items").insert({
      restaurant_id: restaurantId,
      name: form.name.trim(),
      unit: form.unit.trim() || "unit",
      current_stock: Number(form.current_stock) || 0,
      daily_usage_estimate:
        form.daily_usage_estimate.trim() === ""
          ? null
          : Number(form.daily_usage_estimate) || 0,
      reorder_level:
        form.reorder_level.trim() === "" ? null : Number(form.reorder_level) || 0,
      supplier_delivery_days: Number(form.supplier_delivery_days) || 2,
      cost_per_unit:
        form.cost_per_unit.trim() === "" ? null : Number(form.cost_per_unit) || 0,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Item added");
    setAddOpen(false);
    setForm({
      name: "",
      unit: "kg",
      current_stock: "0",
      daily_usage_estimate: "",
      reorder_level: "",
      supplier_delivery_days: "2",
      cost_per_unit: "",
    });
    router.refresh();
  }

  async function handleLogWaste(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(wasteForm.amount);
    if (!wasteForm.productName.trim() || !(amount > 0)) {
      toast.error("Product and amount are required");
      return;
    }
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const noteExtra = wasteForm.note.trim();
    const { error } = await supabase.from("expenses").insert({
      restaurant_id: restaurantId,
      category: "supplies",
      amount,
      date: today,
      note: `${WASTE_NOTE_PREFIX} ${wasteForm.productName.trim()}${
        noteExtra ? ` — ${noteExtra}` : ""
      }`,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Waste logged");
    setWasteOpen(false);
    setWasteForm({ productName: "", amount: "", note: "" });
    router.refresh();
  }

  function focusReorder(name: string) {
    setTab("reorder");
    toast.message(`Focused ${name}`, {
      description: "See recommended order quantity below.",
    });
  }

  const { kpis } = data;

  return (
    <div className="w-full min-w-0 space-y-5">
      <AdminPageIntro
        actions={
          <BrandButton type="button" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add item
          </BrandButton>
        }
      >
        Track stock levels, reorder before you run out, and log waste.
      </AdminPageIntro>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Inventory Value"
          value={formatCurrency(kpis.totalValue)}
          icon={Package}
        />
        <KpiCard
          label="Low Stock Items"
          value={String(kpis.lowStock)}
          icon={AlertTriangle}
          iconClass="text-amber-600"
        />
        <KpiCard
          label="Out of Stock"
          value={String(kpis.outOfStock)}
          icon={PackageX}
          iconClass="text-red-600"
        />
        <KpiCard
          label="Slow Moving Items"
          value={String(kpis.slowMoving)}
          icon={Clock}
          iconClass="text-slate-500"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full space-y-4">
        <TabsList className="admin-surface h-auto w-full flex-wrap justify-start gap-1 border sm:w-auto">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="reorder">Smart Reorder</TabsTrigger>
          <TabsTrigger value="waste">Waste / Loss</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-0">
          {data.rows.length === 0 ? (
            <Empty hint="Add your first inventory item to get started." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-[var(--admin-border)] text-xs text-[var(--admin-muted,#64748B)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Current Stock</th>
                    <th className="px-4 py-3 font-medium">Daily Sales</th>
                    <th className="px-4 py-3 font-medium">Days Remaining</th>
                    <th className="px-4 py-3 font-medium">Reorder Level</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const pill = STATUS_PILL[row.status];
                    const needsAction = row.status === "reorder" || row.status === "out";
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--admin-border)] last:border-0"
                      >
                        <td className="px-4 py-3 font-medium text-[var(--admin-text,#0F172A)]">
                          {row.name}
                          <span className="ml-1 text-xs font-normal text-[var(--admin-muted)]">
                            ({row.unit})
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{row.current_stock}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {row.daily_usage_estimate ?? "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {row.daysRemaining != null ? row.daysRemaining : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {row.reorder_level ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              pill.className
                            )}
                          >
                            {pill.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {needsAction ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => focusReorder(row.name)}
                            >
                              Order Now
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reorder" className="mt-0">
          {data.actionRows.length === 0 ? (
            <Empty hint="Nothing needs reorder right now — all stock looks healthy." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.actionRows.map((row) => {
                const pill = STATUS_PILL[row.status];
                return (
                  <article
                    key={row.id}
                    className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
                        {row.name}
                      </h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          pill.className
                        )}
                      >
                        {pill.label}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-[var(--admin-muted)]">Current Stock</p>
                        <p className="font-semibold tabular-nums">
                          {row.current_stock} {row.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--admin-muted)]">Expected usage/day</p>
                        <p className="font-semibold tabular-nums">
                          {row.daily_usage_estimate ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--admin-muted)]">Supplier delivery</p>
                        <p className="font-semibold tabular-nums">
                          {row.supplier_delivery_days} days
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--admin-muted)]">Recommended order</p>
                        <p
                          className="font-bold tabular-nums"
                          style={{ color: "var(--admin-brand, #0F172A)" }}
                        >
                          {row.recommendedOrder} {row.unit}
                        </p>
                      </div>
                    </div>
                    <BrandButton
                      type="button"
                      className="mt-4 w-full"
                      onClick={() =>
                        toast.success(`Added ${row.recommendedOrder} ${row.unit} of ${row.name} to order list`)
                      }
                    >
                      Add to Order
                    </BrandButton>
                  </article>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="waste" className="mt-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-[var(--admin-muted,#64748B)]">Monthly Waste total</p>
              <p className="text-2xl font-bold tabular-nums text-red-600">
                {formatCurrency(data.monthlyWasteTotal)}
              </p>
            </div>
            <BrandButton type="button" onClick={() => setWasteOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Log Waste
            </BrandButton>
          </div>

          {data.wasteTrendingUp ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Waste is trending up vs last month — review prep portions and expiry dates on
                slow-moving items.
              </p>
            </div>
          ) : null}

          {data.wasteThisMonth.length === 0 ? (
            <Empty hint="No waste logged this month." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)]">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-[var(--admin-border)] text-xs text-[var(--admin-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Amount wasted</th>
                    <th className="px-4 py-3 font-medium">$ Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {data.wasteThisMonth.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-[var(--admin-border)] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{w.productName}</td>
                      <td className="px-4 py-3 tabular-nums">{formatCurrency(w.amount)}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-red-600">
                        {formatCurrency(w.lossUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add inventory item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Name</Label>
              <Input
                id="inv-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-unit">Unit</Label>
                <Input
                  id="inv-unit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-stock">Current stock</Label>
                <Input
                  id="inv-stock"
                  type="number"
                  step="0.01"
                  value={form.current_stock}
                  onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-usage">Daily usage</Label>
                <Input
                  id="inv-usage"
                  type="number"
                  step="0.01"
                  value={form.daily_usage_estimate}
                  onChange={(e) =>
                    setForm({ ...form, daily_usage_estimate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-reorder">Reorder level</Label>
                <Input
                  id="inv-reorder"
                  type="number"
                  step="0.01"
                  value={form.reorder_level}
                  onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-delivery">Supplier days</Label>
                <Input
                  id="inv-delivery"
                  type="number"
                  value={form.supplier_delivery_days}
                  onChange={(e) =>
                    setForm({ ...form, supplier_delivery_days: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-cost">Cost / unit</Label>
                <Input
                  id="inv-cost"
                  type="number"
                  step="0.01"
                  value={form.cost_per_unit}
                  onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <BrandButton type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </BrandButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={wasteOpen} onOpenChange={setWasteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log waste</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogWaste} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="waste-product">Product</Label>
              <Input
                id="waste-product"
                list="waste-products"
                value={wasteForm.productName}
                onChange={(e) =>
                  setWasteForm({ ...wasteForm, productName: e.target.value })
                }
                required
              />
              <datalist id="waste-products">
                {productNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="waste-amount">$ Loss</Label>
              <Input
                id="waste-amount"
                type="number"
                step="0.01"
                min="0"
                value={wasteForm.amount}
                onChange={(e) => setWasteForm({ ...wasteForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="waste-note">Note (optional)</Label>
              <Input
                id="waste-note"
                value={wasteForm.note}
                onChange={(e) => setWasteForm({ ...wasteForm, note: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setWasteOpen(false)}>
                Cancel
              </Button>
              <BrandButton type="submit" disabled={saving}>
                {saving ? "Saving…" : "Log waste"}
              </BrandButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-[var(--admin-muted,#64748B)]">{label}</p>
        <Icon className={cn("h-4 w-4 text-[var(--admin-muted)]", iconClass)} aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--admin-text,#0F172A)]">
        {value}
      </p>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center text-sm text-[var(--admin-muted,#64748B)]">
      {hint}
    </div>
  );
}
