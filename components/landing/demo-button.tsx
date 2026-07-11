"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function DemoButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleTryDemo() {
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
      onClick={handleTryDemo}
      disabled={loading}
      className={cn("btn-outline-navy h-12 px-8 text-base disabled:opacity-50", className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
      Try Demo
    </button>
  );
}
