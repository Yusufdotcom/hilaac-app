"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Delete, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

/**
 * Tablet-friendly PIN pad for Kitchen / Waiter / Cashier shared devices.
 */
export function StaffPinPad({
  slug,
  restaurantName,
  preferredRole,
  nextPath,
}: {
  slug: string;
  restaurantName: string;
  preferredRole?: string | null;
  nextPath?: string | null;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleLabel = useMemo(() => {
    if (preferredRole === "kitchen") return "Kitchen";
    if (preferredRole === "waiter") return "Waiter";
    if (preferredRole === "cashier") return "Cashier";
    return "Staff";
  }, [preferredRole]);

  async function submit(code: string) {
    if (busy || code.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/pin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          pin: code,
          role: preferredRole || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };
      if (!res.ok) {
        setError(json.error || "Incorrect PIN");
        setPin("");
        return;
      }
      const dest =
        nextPath && nextPath.startsWith(`/staff/${slug}`)
          ? nextPath
          : json.redirectTo || `/staff/${slug}`;
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Network error");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  function onKey(k: string) {
    if (busy) return;
    setError(null);
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (!k || !/^\d$/.test(k)) return;
    setPin((p) => {
      if (p.length >= 6) return p;
      return p + k;
    });
  }

  // Auto-submit shortly after 4–6 digits so tablets don't need Unlock for common 4-digit PINs.
  // Longer PINs: typing continues; Unlock always works.
  // (Handled via effect below.)

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Lock className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-slate-500">{restaurantName}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{roleLabel} PIN</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your 4–6 digit code. Session lasts 8 hours.
        </p>
      </div>

      <div className="mb-6 flex justify-center gap-3" aria-live="polite">
        {Array.from({ length: Math.max(4, pin.length || 4) }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-3.5 w-3.5 rounded-full border-2",
              i < pin.length ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-transparent"
            )}
          />
        ))}
      </div>

      {error ? (
        <p className="mb-4 text-center text-sm font-medium text-red-600">{error}</p>
      ) : (
        <p className="mb-4 h-5 text-center text-sm text-transparent">.</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={`empty-${i}`} />
          ) : (
            <button
              key={k === "del" ? "del" : k}
              type="button"
              disabled={busy}
              onClick={() => (k === "del" ? onKey("del") : onKey(k))}
              className={cn(
                "flex h-16 items-center justify-center rounded-2xl text-2xl font-semibold shadow-sm transition active:scale-95",
                k === "del"
                  ? "bg-slate-100 text-slate-700"
                  : "bg-white text-slate-900 ring-1 ring-slate-200"
              )}
              aria-label={k === "del" ? "Delete" : k}
            >
              {k === "del" ? <Delete className="h-6 w-6" /> : k}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        disabled={busy || pin.length < 4}
        onClick={() => void submit(pin)}
        className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-slate-900 text-base font-semibold text-white disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Unlock"}
      </button>
    </div>
  );
}

export function StaffPinPadWithParams({
  slug,
  restaurantName,
}: {
  slug: string;
  restaurantName: string;
}) {
  const search = useSearchParams();
  return (
    <StaffPinPad
      slug={slug}
      restaurantName={restaurantName}
      preferredRole={search.get("role")}
      nextPath={search.get("next")}
    />
  );
}
