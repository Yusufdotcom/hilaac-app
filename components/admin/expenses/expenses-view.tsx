"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { BrandButton } from "@/components/admin/brand-button";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import { pctOf } from "@/lib/expenses/pnl-math";
import type { ExpensesPageData } from "@/lib/expenses/fetch-expenses";
import type { ExpenseCategory } from "@/types/database";

const CATEGORIES: ExpenseCategory[] = ["rent", "utilities", "labor", "supplies", "other"];

function categoryLabel(c: string) {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function ExpensesView({
  restaurantId,
  data,
  gated,
}: {
  restaurantId: string;
  data: ExpensesPageData | null;
  gated?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "other" as ExpenseCategory,
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  if (gated) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">
          Expenses &amp; P&amp;L are on Galeyr 1.0
        </p>
        <p className="mt-1 text-sm text-[var(--admin-muted,#64748B)]">
          Upgrade to track expenses, margins, and profitability waterfall.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-[var(--admin-muted,#64748B)]">Could not load expenses.</p>
    );
  }

  const { waterfall, margins } = data;
  const delta = data.expenseDeltaPct;
  const deltaUp = delta != null && delta > 0;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      restaurant_id: restaurantId,
      category: form.category,
      amount,
      date: form.date,
      note: form.note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense added");
    setAddOpen(false);
    setForm({
      category: "other",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      note: "",
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense deleted");
    router.refresh();
  }

  const maxSeries = Math.max(...data.monthlySeries.map((m) => m.total), 1);

  return (
    <div className="w-full min-w-0 space-y-5">
      <AdminPageIntro>
        Track monthly spend and see how revenue turns into estimated profit.
      </AdminPageIntro>

      <Tabs defaultValue="profitability" className="w-full space-y-4">
        <TabsList className="admin-surface h-auto w-full flex-wrap justify-start gap-1 border sm:w-auto">
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="profitability" className="mt-0 space-y-5">
          <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5">
            <p className="text-xs text-[var(--admin-muted,#64748B)]">Monthly Expense total</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <p className="text-3xl font-bold tabular-nums text-[var(--admin-text,#0F172A)]">
                {formatCurrency(data.monthExpenseTotal)}
              </p>
              {delta != null ? (
                <p
                  className={cn(
                    "text-sm font-semibold",
                    deltaUp ? "text-red-600" : delta < 0 ? "text-emerald-600" : "text-[var(--admin-muted)]"
                  )}
                >
                  {deltaUp ? "↑" : delta < 0 ? "↓" : "—"} {Math.abs(Math.round(delta))}% vs last month
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5">
            <p className="text-sm font-semibold text-[var(--admin-text,#0F172A)]">P&amp;L waterfall</p>
            <WaterfallBar label="Revenue" amount={waterfall.revenue} widthPct={100} tone="good" />
            <WaterfallBar
              label="Cost of Goods"
              amount={waterfall.cogs}
              widthPct={pctOf(waterfall.cogs, waterfall.revenue)}
              tone="bad"
            />
            <WaterfallBar
              label="Labor"
              amount={waterfall.labor}
              widthPct={pctOf(waterfall.labor, waterfall.revenue)}
              tone="bad"
            />
            <WaterfallBar
              label="Operating Expenses"
              amount={waterfall.operating}
              widthPct={pctOf(waterfall.operating, waterfall.revenue)}
              tone="bad"
            />
            <WaterfallBar
              label="Est. Profit"
              amount={waterfall.estProfit}
              widthPct={pctOf(Math.max(waterfall.estProfit, 0), waterfall.revenue)}
              tone={waterfall.estProfit >= 0 ? "good" : "bad"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Gross Margin" value={fmtPct(margins.grossMarginPct)} good />
            <MetricCard label="Net Margin" value={fmtPct(margins.netMarginPct)} good={ (margins.netMarginPct ?? 0) >= 0 } />
            <MetricCard label="Food Cost %" value={fmtPct(margins.foodCostPct)} />
            <MetricCard label="Labor %" value={fmtPct(margins.laborPct)} />
          </div>

          {data.insightCategory ? (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-card)] px-4 py-3 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A373]" aria-hidden="true" />
              <p className="text-[var(--admin-text,#0F172A)]">
                The biggest increase came from{" "}
                <span className="font-semibold">{categoryLabel(data.insightCategory)}</span>.
              </p>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="expenses" className="mt-0 space-y-4">
          <div className="flex justify-end">
            <BrandButton type="button" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Expense
            </BrandButton>
          </div>

          <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5">
            <p className="mb-4 text-sm font-semibold text-[var(--admin-text,#0F172A)]">
              Expenses over time
            </p>
            <div className="flex h-36 items-end gap-2">
              {data.monthlySeries.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full max-w-[48px] rounded-t-md"
                    style={{
                      height: `${Math.max(8, Math.round((m.total / maxSeries) * 100))}%`,
                      backgroundColor: "var(--admin-brand, #0F172A)",
                      opacity: 0.75,
                    }}
                    title={formatCurrency(m.total)}
                  />
                  <span className="text-[10px] text-[var(--admin-muted,#64748B)]">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {data.expenses.length === 0 ? (
            <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-card)] px-5 py-10 text-center text-sm text-[var(--admin-muted)]">
              No expenses logged this month.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)]">
              {data.expenses.map((exp) => (
                <li
                  key={exp.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--admin-text,#0F172A)]">
                      {categoryLabel(exp.category)} · {formatCurrency(Number(exp.amount))}
                    </p>
                    <p className="text-xs text-[var(--admin-muted,#64748B)]">
                      {exp.date}
                      {exp.note ? ` · ${exp.note}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(exp.id)}
                    className="rounded-lg p-2 text-[var(--admin-muted)] hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete expense"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as ExpenseCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount">Amount</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-date">Date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-note">Note</Label>
              <Input
                id="exp-note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
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
    </div>
  );
}

function WaterfallBar({
  label,
  amount,
  widthPct,
  tone,
}: {
  label: string;
  amount: number;
  widthPct: number;
  tone: "good" | "bad";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[var(--admin-muted,#64748B)]">{label}</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            tone === "good" ? "text-emerald-600" : "text-red-600"
          )}
        >
          {formatCurrency(amount)}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--admin-subtle,#F1F5F9)]">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "good" ? "bg-emerald-500" : "bg-red-500"
          )}
          style={{ width: `${Math.max(amount === 0 ? 0 : 4, widthPct)}%` }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-4">
      <p className="text-xs text-[var(--admin-muted,#64748B)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          good === true && "text-emerald-600",
          good === false && "text-red-600",
          good == null && "text-[var(--admin-text,#0F172A)]"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}
