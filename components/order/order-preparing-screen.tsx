"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import { useOrderAppearanceOptional } from "@/components/order/order-appearance-context";
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
  const appearance = useOrderAppearanceOptional();
  const accent = brand?.accent ?? resolveCustomerAccent(brand?.branding ?? {}) ?? HILAAC_GOLD;
  const accentText = customerAccentTextStyleFromAccent(accent);
  const isDark = appearance?.theme === "dark";
  // Explicit colors — do not rely on text-muted-foreground (light slate on dark bg).
  const titleColor = isDark ? "#F5F0E8" : "#1C1917";
  const bodyColor = isDark ? "#D6CDBF" : "#57534E";
  const cardBg = isDark ? "rgba(255,255,255,0.06)" : "hsl(var(--card))";
  const cardBorder = isDark ? "rgba(255,255,255,0.14)" : "hsl(var(--border))";
  const inputBg = isDark ? "rgba(0,0,0,0.35)" : "hsl(var(--background))";
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
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: brandColorWithAlpha(accent, 0.15),
            color: accent,
            boxShadow: `0 8px 24px ${brandColorWithAlpha(accent, 0.18)}`,
          }}
        >
          {error ? (
            <span className="text-base font-bold" style={{ color: titleColor }} aria-hidden="true">
              !
            </span>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" style={accentText} aria-hidden="true" />
          )}
        </div>

        {error ? (
          <>
            <h1
              className="text-lg font-bold leading-tight tracking-tight"
              style={{ color: titleColor }}
            >
              Order status unavailable
            </h1>
            <p
              className="mx-auto max-w-sm text-[13px] leading-snug"
              style={{ color: bodyColor }}
            >
              {error}
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-lg font-bold leading-tight tracking-tight"
              style={{ color: titleColor }}
            >
              {message}
            </h1>
            {submessage && (
              <p
                className="mx-auto max-w-sm text-[13px] leading-snug"
                style={{ color: bodyColor }}
              >
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
              className="mx-auto w-full max-w-sm space-y-3 rounded-2xl px-4 py-4 text-left shadow-sm"
              style={{
                backgroundColor: cardBg,
                border: `1px solid ${cardBorder}`,
              }}
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="recover-phone"
                  className="text-xs"
                  style={{ color: titleColor }}
                >
                  Phone number used on this order
                </Label>
                <Input
                  id="recover-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="e.g. 0612345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 rounded-xl border-0"
                  style={{
                    backgroundColor: inputBg,
                    color: titleColor,
                  }}
                  disabled={recovering}
                />
              </div>
              {recoverError && (
                <p className="text-xs font-medium" style={{ color: isDark ? "#FCA5A5" : "#DC2626" }}>
                  {recoverError}
                </p>
              )}
              <Button
                type="submit"
                className="h-11 w-full rounded-xl text-sm font-semibold text-white hover:text-white"
                style={{ backgroundColor: accent, color: "#ffffff" }}
                disabled={recovering || phone.trim().length < 8}
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
            <p
              className="mx-auto max-w-xs text-center text-[13px] leading-snug"
              style={{ color: bodyColor }}
            >
              Hubi internetkaaga oo isku day mar kale.
            </p>
          )}

          {onRetry && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                style={{
                  color: titleColor,
                  borderColor: cardBorder,
                  backgroundColor: "transparent",
                }}
                onClick={onRetry}
              >
                {showAccessRecovery ? "Retry with saved session" : "Retry"}
              </Button>
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
                className="rounded-xl px-6"
                style={{ color: titleColor, borderColor: cardBorder }}
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
