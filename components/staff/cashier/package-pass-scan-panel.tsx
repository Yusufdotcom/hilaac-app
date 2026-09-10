"use client";

import { useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PackagePassScanPanel({ enabled }: { enabled: boolean }) {
  const [passCode, setPassCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastOk, setLastOk] = useState<string | null>(null);

  if (!enabled) return null;

  async function handleCheckin(e?: React.FormEvent) {
    e?.preventDefault();
    const code = passCode.trim().toUpperCase();
    if (!code) {
      toast.error("Enter a pass code");
      return;
    }
    setLoading(true);
    setLastOk(null);
    try {
      const res = await fetch("/api/admin/packages/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass_code: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Check-in failed");
      const label = [data.customer_name, data.package_name].filter(Boolean).join(" · ");
      setLastOk(label || "Checked in");
      toast.success(label ? `Checked in: ${label}` : "Checked in");
      setPassCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <ScanLine className="h-5 w-5 text-[#D4A373]" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold text-[#0F172A]">Scan Package Pass</h2>
          <p className="text-xs text-[#64748B]">Enter the 8-character pass code to check in</p>
        </div>
      </div>
      <form onSubmit={handleCheckin} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={passCode}
          onChange={(e) => setPassCode(e.target.value.toUpperCase())}
          placeholder="Pass code"
          className="font-mono tracking-widest uppercase"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <Button type="submit" disabled={loading} className="shrink-0 rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check in"}
        </Button>
      </form>
      {lastOk ? (
        <p className="mt-2 text-sm font-medium text-emerald-700">{lastOk}</p>
      ) : null}
    </section>
  );
}
