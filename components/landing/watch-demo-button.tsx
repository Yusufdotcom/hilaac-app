"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function WatchDemoButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleWatchDemo() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_demo_restaurant");
      if (error) throw error;
      toast.success("Demo restaurant ready! It self-deletes in 2 hours.");
      router.push(`/order/${data}`);
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
      onClick={handleWatchDemo}
      disabled={loading}
      className={cn("landing-btn-ghost-lg disabled:opacity-50", className)}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
      )}
      Watch Demo
    </button>
  );
}
