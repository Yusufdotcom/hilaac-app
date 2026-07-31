"use client";

import { useState } from "react";
import { Gift, Loader2, Search, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCustomerPhone } from "@/lib/utils";

type LookupResult = {
  enabled: boolean;
  phone_normalized: string;
  current_count: number;
  available_rewards: number;
  target_order_count: number;
  reward_description: string | null;
  orders_away: number | null;
};

export function LoyaltyLookupPanel({ slug }: { slug: string }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  async function handleLookup(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/staff/loyalty/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setResult(data as LookupResult);
      if (!data.enabled) {
        toast.message("Loyalty program is not enabled for this restaurant.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem() {
    if (!result || result.available_rewards < 1) return;
    const ok = window.confirm(
      `Redeem 1× ${result.reward_description ?? "reward"} for ${formatCustomerPhone(result.phone_normalized) ?? result.phone_normalized}?`
    );
    if (!ok) return;

    setRedeeming(true);
    try {
      const res = await fetch("/api/staff/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, phone: result.phone_normalized }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Redeem failed");
      toast.success("Reward redeemed");
      setResult((prev) =>
        prev
          ? {
              ...prev,
              available_rewards: Number(data.available_rewards ?? 0),
              current_count: Number(data.current_count ?? prev.current_count),
              orders_away: Math.max(
                0,
                prev.target_order_count - Number(data.current_count ?? prev.current_count)
              ),
            }
          : prev
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Redeem failed");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Ticket className="h-5 w-5 text-[#D4A373]" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold text-[#0F172A]">Loyalty lookup</h2>
          <p className="text-xs text-[#64748B]">Search by phone to check progress or redeem a reward</p>
        </div>
      </div>

      <form onSubmit={handleLookup} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="tel"
          inputMode="tel"
          placeholder="Customer phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-11 text-base"
          style={{ fontSize: 16 }}
          autoComplete="tel"
        />
        <Button type="submit" disabled={loading || !phone.trim()} className="h-11 shrink-0 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Look up
        </Button>
      </form>

      {result && result.enabled && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-[#0F172A]">
            {formatCustomerPhone(result.phone_normalized) ?? result.phone_normalized}
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            Progress:{" "}
            <span className="font-semibold text-[#0F172A]">
              {result.current_count}/{result.target_order_count}
            </span>
            {result.orders_away != null && result.available_rewards < 1 && (
              <> · {result.orders_away} away from {result.reward_description}</>
            )}
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            Available rewards:{" "}
            <span className="font-semibold text-[#0F172A]">{result.available_rewards}</span>
            {result.reward_description ? ` · ${result.reward_description}` : null}
          </p>

          <Button
            type="button"
            className="mt-3 h-10 gap-2 bg-emerald-600 hover:bg-emerald-700"
            disabled={redeeming || result.available_rewards < 1}
            onClick={handleRedeem}
          >
            {redeeming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gift className="h-4 w-4" />
            )}
            Redeem Reward
          </Button>
        </div>
      )}
    </section>
  );
}
