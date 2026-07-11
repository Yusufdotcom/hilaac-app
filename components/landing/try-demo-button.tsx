"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function TryDemoButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleTryDemo() {
    setLoading(true);
    try {
      const res = await fetch("/api/demo/create", { method: "POST" });
      const data = (await res.json()) as { success?: boolean; slug?: string; error?: string; details?: string };

      if (!res.ok || !data.success || !data.slug) {
        toast.error(data.error ?? data.details ?? "Couldn't start the demo. Please try again.");
        return;
      }

      toast.success("Demo restaurant ready! It self-deletes in 24 hours.");
      router.push(`/admin/${data.slug}/dashboard`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't start the demo. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleTryDemo}
      disabled={loading}
      className={className ?? "landing-btn-solid-white text-sm disabled:opacity-60"}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Try Demo
    </button>
  );
}
