"use client";

import { useEffect, useState } from "react";
import { Loader2, Phone } from "lucide-react";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import {
  brandColorWithAlpha,
  customerAccentTextStyleFromAccent,
  HILAAC_GOLD,
  resolveCustomerAccent,
} from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const ORDER_SUBMIT_RETRY_MS = 5_000;

/** @deprecated Prefer always showing recover when onRecoverAccess is passed. */
export function isOrderAccessError(error: string | null | undefined) {
  if (!error) return false;
  const e = error.toLowerCase();
  return (
    e.includes("expired") ||
    e.includes("new device") ||
    e.includes("device you ordered") ||
    e.includes("re-enter the phone") ||
    e.includes("phone number") ||
    e.includes("not valid") ||
    e.includes("unable to load this order status") ||
    e.includes("could not load order status") ||
    e.includes("unauthorized") ||
    e.includes("not found")
  );
}

export function OrderPreparingScreen({
  message = "Dalabkaga waa la diyaarinayaa...",
  submessage,
  error,
  onRetry,
  onRecoverAccess,
  className,
}: {
  message?: string;
  submessage?: string;
  error?: string | null;
  onRetry?: () => void;
  /** When set with an error, always show phone re-verification. */
  onRecoverAccess?: (phone: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  className?: string;
}) {
  const brand = useOrderBrandOptional();
  const accent = brand?.accent ?? resolveCustomerAccent(brand?.branding ?? {}) ?? HILAAC_GOLD;
  const accentText = customerAccentTextStyleFromAccent(accent);
  const showAccessRecovery = Boolean(error && onRecoverAccess);

  const [phone, setPhone] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);

  useEffect(() => {
    setRecoverError(null);
    setPhone("");
  }, [error]);

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    if (!onRecoverAccess || recovering) return;
    setRecovering(true);
    setRecoverError(null);
    try {
      const result = await onRecoverAccess(phone);
      if (!result.ok) setRecoverError(result.error);
    } finally {
      setRecovering(false);
    }
  }

  const canSubmit = !recovering && phoneDigits(phone).length >= 8;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 flex-col justify-center overflow-hidden px-1",
        "animate-in fade-in slide-in-from-bottom-3 duration-500",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="shrink-0 space-y-2 text-center">
        <div
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl text-white"
          style={
            error
              ? {
                  backgroundColor: accent,
                  boxShadow: `0 10px 28px ${brandColorWithAlpha(accent, 0.35)}`,
                }
              : {
                  backgroundColor: brandColorWithAlpha(accent, 0.14),
                  color: accent,
                  boxShadow: `0 10px 28px ${brandColorWithAlpha(accent, 0.2)}`,
                }
          }
        >
          {error ? (
            <span className="text-lg font-bold leading-none text-white" aria-hidden="true">
              !
            </span>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" style={accentText} aria-hidden="true" />
          )}
        </div>

        {error ? (
          <>
            <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">
              Order status unavailable
            </h1>
            <p className="mx-auto max-w-sm text-[13px] leading-snug text-muted-foreground">
              {error}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">
              {message}
            </h1>
            {submessage && (
              <p className="mx-auto max-w-sm text-[13px] leading-snug text-muted-foreground">
                {submessage}
              </p>
            )}
          </>
        )}
      </div>

      {error ? (
        <div className="mt-4 shrink-0 space-y-3">
          {showAccessRecovery ? (
            <form
              onSubmit={(e) => void handleRecover(e)}
              className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-border/70 bg-card px-5 py-5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.08)]"
            >
              <div className="space-y-2">
                <Label
                  htmlFor="recover-phone"
                  className="text-[13px] font-semibold text-foreground"
                >
                  Phone number used on this order{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="recover-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0612345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={recovering}
                    className={cn(
                      "h-14 rounded-2xl border-border bg-muted/50 pl-12 pr-4",
                      "text-base leading-normal tracking-wide text-foreground",
                      "placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2"
                    )}
                    style={{
                      fontSize: 16,
                      ["--tw-ring-color" as string]: brandColorWithAlpha(accent, 0.45),
                    }}
                    aria-invalid={Boolean(recoverError)}
                  />
                </div>
                {recoverError && (
                  <p className="text-xs font-semibold text-red-600">{recoverError}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  "h-12 w-full rounded-2xl text-sm font-semibold text-white shadow-[0_10px_24px_rgba(158,46,46,0.28)]",
                  "transition-all duration-200 hover:opacity-95 active:scale-[0.98]",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                )}
                style={{
                  backgroundColor: accent,
                  color: "#ffffff",
                }}
              >
                {recovering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Checking…
                  </>
                ) : (
                  "Recover my order"
                )}
              </Button>
            </form>
          ) : (
            <p className="mx-auto max-w-xs text-center text-[13px] leading-snug text-muted-foreground">
              Hubi internetkaaga oo isku day mar kale.
            </p>
          )}

          {onRetry && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onRetry}
                className="text-[13px] font-semibold text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {showAccessRecovery ? "Retry with saved session" : "Retry"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 shrink-0">
          <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
            <div
              className="h-3 w-full animate-pulse rounded-full"
              style={{ backgroundColor: brandColorWithAlpha(accent, 0.18) }}
            />
            <div
              className="mx-auto h-3 w-[80%] animate-pulse rounded-full"
              style={{ backgroundColor: brandColorWithAlpha(accent, 0.12) }}
            />
            <div
              className="mx-auto h-3 w-[60%] animate-pulse rounded-full"
              style={{ backgroundColor: brandColorWithAlpha(accent, 0.08) }}
            />
          </div>
          {onRetry && (
            <div className="mt-auto flex justify-center pt-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-border px-6 text-foreground"
                onClick={onRetry}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** Full-viewport overlay used while creating an order before hard navigation. */
export function OrderSubmittingOverlay({
  open,
  message = "Dalabkaga waa la diyaarinayaa...",
  error,
  onRetry,
  showRetryAfterMs = ORDER_SUBMIT_RETRY_MS,
}: {
  open: boolean;
  message?: string;
  error?: string | null;
  onRetry?: () => void;
  showRetryAfterMs?: number;
}) {
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowRetry(false);
      return;
    }
    if (error) {
      setShowRetry(true);
      return;
    }
    setShowRetry(false);
    const timer = window.setTimeout(() => setShowRetry(true), showRetryAfterMs);
    return () => window.clearTimeout(timer);
  }, [open, error, showRetryAfterMs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-background/95 text-foreground backdrop-blur-sm">
      <OrderPreparingScreen
        message={message}
        submessage={error ? undefined : "Fadlan sug…"}
        error={error}
        onRetry={showRetry || error ? onRetry : undefined}
      />
    </div>
  );
}
