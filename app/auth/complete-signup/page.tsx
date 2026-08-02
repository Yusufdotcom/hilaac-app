"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { completeGoogleSignupAction } from "./actions";

export default function CompleteSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setFullName(
        String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim()
      );
      setChecking(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("restaurantName", restaurantName);
      formData.set("fullName", fullName);
      const result = await completeGoogleSignupAction(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
      toast.error(err instanceof Error ? err.message : "Could not finish signup");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <AuthShell title="Finish setting up" description="Loading…">
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-hilaac-gold" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Finish setting up"
      description="Your Google account is connected. Tell us about your restaurant to continue."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="restaurantName">Restaurant name</Label>
          <Input
            id="restaurantName"
            required
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="e.g. Baraaka Restaurant"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">Your name</Label>
          <Input
            id="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Continue
        </Button>
      </form>
    </AuthShell>
  );
}
