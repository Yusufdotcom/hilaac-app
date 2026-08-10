"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PlatformSettingsForm() {
  const [evc, setEvc] = useState("");
  const [edahab, setEdahab] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/platform/settings", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load settings");
        setEvc(data.evc_ussd_code ?? "");
        setEdahab(data.edahab_ussd_code ?? "");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/platform/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evc_ussd_code: evc,
          edahab_ussd_code: edahab,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Platform payment codes saved (encrypted at rest).");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      className="mx-auto max-w-lg space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-white">Payment collection</h1>
        <p className="mt-1 text-sm text-slate-400">
          Hilaac&apos;s own EVC / eDahab USSD codes for collecting restaurant subscription
          payments. Stored with AES-256-GCM — separate from each restaurant&apos;s customer
          merchant codes.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="platform-evc" className="text-slate-200">
          EVC USSD base (amount appended automatically)
        </Label>
        <Input
          id="platform-evc"
          value={evc}
          onChange={(e) => setEvc(e.target.value)}
          placeholder="e.g. *712*9*"
          className="border-white/15 bg-[#0B1220] text-white"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="platform-edahab" className="text-slate-200">
          eDahab USSD base (amount appended automatically)
        </Label>
        <Input
          id="platform-edahab"
          value={edahab}
          onChange={(e) => setEdahab(e.target.value)}
          placeholder="e.g. *888*9*"
          className="border-white/15 bg-[#0B1220] text-white"
        />
      </div>

      <p className="text-xs text-slate-500">
        Tip: enter the prefix only (e.g. <span className="font-mono">*712*9*</span>). Owners dial
        with $29 or $79 filled in automatically.
      </p>

      <Button
        type="submit"
        disabled={saving}
        className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400"
      >
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save encrypted codes
      </Button>
    </form>
  );
}
