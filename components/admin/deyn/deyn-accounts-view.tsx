"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, WalletCards } from "lucide-react";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import type { DeynAccount } from "@/types/database";

export function DeynAccountsView({
  slug,
  initialAccounts,
  gated,
}: {
  slug: string;
  initialAccounts: DeynAccount[];
  gated?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [creditLimit, setCreditLimit] = useState("50");

  if (gated) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-5 py-10 text-center">
        <p className="text-sm font-semibold">Deyn ledger unavailable</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={`/admin/${slug}/billing`}>View billing</Link>
        </Button>
      </div>
    );
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/deyn/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        credit_limit: Number(creditLimit),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not create account");
      return;
    }
    setAccounts((prev) => [json.account as DeynAccount, ...prev]);
    setShowForm(false);
    setCustomerName("");
    setCustomerPhone("");
    setCreditLimit("50");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminPageIntro>
          Credit accounts for regulars. Each account gets an 8-character Deyn code for QR
          checkout.
        </AdminPageIntro>
        <Button type="button" onClick={() => setShowForm((v) => !v)}>
          <WalletCards className="mr-2 h-4 w-4" />
          {showForm ? "Close form" : "New Deyn account"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(e) => void createAccount(e)}
          className="grid gap-4 rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] p-5 sm:grid-cols-3"
        >
          <div>
            <Label htmlFor="deyn-name">Customer name</Label>
            <Input
              id="deyn-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="deyn-phone">Phone (WhatsApp)</Label>
            <Input
              id="deyn-phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="0612345678"
              required
            />
          </div>
          <div>
            <Label htmlFor="deyn-limit">Credit limit ($)</Label>
            <Input
              id="deyn-limit"
              type="number"
              min={0}
              step="0.01"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create &amp; send WhatsApp
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-[var(--admin-bg,#F8FAFC)] text-left text-[var(--admin-muted,#64748B)]">
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">Limit</th>
              <th className="px-4 py-3 font-semibold">Balance owed</th>
              <th className="px-4 py-3 font-semibold">Remaining</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--admin-muted,#64748B)]">
                  No Deyn accounts yet.
                </td>
              </tr>
            ) : (
              accounts.map((a) => {
                const remaining = Math.max(0, Number(a.credit_limit) - Number(a.balance));
                return (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.customer_name}</div>
                      <div className="text-xs text-[var(--admin-muted,#64748B)]">
                        {a.customer_phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold tracking-wider">
                      {a.deyn_code}
                    </td>
                    <td className="px-4 py-3">{formatCurrency(Number(a.credit_limit))}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(a.balance))}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">
                      {formatCurrency(remaining)}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {a.is_active ? "Active" : "Inactive"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
