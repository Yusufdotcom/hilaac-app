"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { loadOrderAccessToken } from "@/lib/order/order-access-storage";
import { cn } from "@/lib/utils";

export function OrderRatingCard({
  orderId,
  initialRating,
  accent,
}: {
  orderId: string;
  initialRating?: number | null;
  accent: string;
}) {
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(value: number) {
    if (rating != null || saving) return;
    setSaving(true);
    try {
      const accessToken = loadOrderAccessToken(orderId);
      const res = await fetch(`/api/orders/${orderId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value, accessToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save rating");
      setRating(data.rating ?? value);
      toast.success("Mahadsanid — waad qiimeysay");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Rating failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="mt-3 rounded-2xl border px-4 py-3 text-center"
      style={{ borderColor: `${accent}33` }}
    >
      <p className="text-xs font-medium text-muted-foreground">
        {rating != null ? "Waad qiimeysay" : "Sidee kuu soo gaadhay adeeggeena?"}
      </p>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = (hover ?? rating ?? 0) >= n;
          return (
            <button
              key={n}
              type="button"
              disabled={rating != null || saving}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onMouseEnter={() => rating == null && setHover(n)}
              onMouseLeave={() => setHover(null)}
              onClick={() => submit(n)}
              className="rounded-lg p-1 transition disabled:cursor-default"
            >
              <Star
                className={cn("h-7 w-7", filled ? "fill-current" : "fill-transparent")}
                style={{ color: filled ? accent : "#94a3b8" }}
                strokeWidth={1.75}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
