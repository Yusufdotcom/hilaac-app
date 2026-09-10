"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function readJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(res.ok ? "Empty response from server" : `Server error (${res.status})`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid server response (${res.status})`);
  }
}

export function PlatformSettingsForm() {
  const [evc, setEvc] = useState("");
  const [edahab, setEdahab] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/platform/settings", { cache: "no-store" });
        const data = await readJsonSafe(res);
        if (!res.ok) throw new Error(String(data.error ?? "Failed to load settings"));
        setEvc(String(data.evc_ussd_code ?? ""));
        setEdahab(String(data.edahab_ussd_code ?? ""));
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
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(String(data.error ?? "Save failed"));
      toast.success("Platform payment codes saved (encrypted at rest).");
      // Reload from server to confirm persistence (not client-only state).
      const reload = await fetch("/api/platform/settings", { cache: "no-store" });
      const again = await readJsonSafe(reload);
      if (reload.ok) {
        setEvc(String(again.evc_ussd_code ?? ""));
        setEdahab(String(again.edahab_ussd_code ?? ""));
      }
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
      className="mx-auto max-w-lg space-y-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
    >
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Hilaac&apos;s own EVC / eDahab merchant USSD codes for collecting restaurant
          subscription payments. Encrypted at rest — separate from each tenant&apos;s customer
          payment codes.
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
        className="w-full bg-[#9E2E2E] text-white hover:bg-[#821f1f]"
      >
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save encrypted codes
      </Button>
    </form>
  );
}
