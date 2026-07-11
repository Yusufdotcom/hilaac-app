"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction } from "./actions";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    restaurantName: "",
    fullName: "",
    email: "",
    password: "",
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await signupAction(formData);

      if (result?.needsConfirmation) {
        toast.info("Check your email to confirm your account, then log in.");
        router.push("/login");
        return;
      }

      if (result?.error) {
        toast.error(result.error);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Start your free trial"
      description="7 days free. No credit card required."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-hilaac-gold hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="restaurantName">Restaurant Name</Label>
          <Input
            id="restaurantName"
            name="restaurantName"
            required
            placeholder="e.g. Baraaka Restaurant"
            value={form.restaurantName}
            onChange={(e) => setForm({ ...form, restaurantName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            name="fullName"
            required
            placeholder="Your full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@restaurant.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="At least 6 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Start Free Trial
        </Button>
      </form>
    </AuthShell>
  );
}
