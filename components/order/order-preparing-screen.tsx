"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import {
  brandColorWithAlpha,
  customerAccentTextStyleFromAccent,
  HILAAC_GOLD,
  resolveCustomerAccent,
} from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const ORDER_SUBMIT_RETRY_MS = 5_000;

export function OrderPreparingScreen({
  message = "Halaalabkaaga waa la diyaarinayaa...",
  submessage,
  error,
  onRetry,
  className,
}: {
  message?: string;
  submessage?: string;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  const brand = useOrderBrandOptional();
  const accent = brand?.accent ?? resolveCustomerAccent(brand?.branding ?? {}) ?? HILAAC_GOLD;
  const accentText = customerAccentTextStyleFromAccent(accent);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
        style={{
          backgroundColor: brandColorWithAlpha(accent, 0.14),
          boxShadow: `0 12px 40px ${brandColorWithAlpha(accent, 0.22)}`,
        }}
      >
        {error ? (
          <span className="text-2xl" aria-hidden="true">
            !
          </span>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin" style={accentText} aria-hidden="true" />
        )}
      </div>

      {error ? (
        <>
          <p className="text-base font-bold text-gray-900">{error}</p>
          <p className="mt-2 max-w-xs text-sm text-gray-500">
            Hubi internetkaaga oo isku day mar kale.
          </p>
          {onRetry && (
            <Button
              type="button"
              className="mt-5 rounded-xl px-6"
              style={{ backgroundColor: accent, color: "#fff" }}
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="text-base font-bold text-gray-900">{message}</p>
          {submessage && (
            <p className="mt-2 max-w-xs text-sm text-gray-500">{submessage}</p>
          )}
          <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
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
            <Button
              type="button"
              variant="outline"
              className="mt-6 rounded-xl px-6"
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** Full-viewport overlay used while creating an order before hard navigation. */
export function OrderSubmittingOverlay({
  open,
  message = "Halaalabkaaga waa la diyaarinayaa...",
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
    <div className="fixed inset-0 z-[300] flex flex-col bg-white/95 backdrop-blur-sm">
      <OrderPreparingScreen
        message={message}
        submessage={error ? undefined : "Fadlan sug…"}
        error={error}
        onRetry={showRetry || error ? onRetry : undefined}
      />
    </div>
  );
}
