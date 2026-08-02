"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthDivider, GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) return;
    if (error === "no-profile") {
      toast.error(
        "No profile found for this account. Make sure profiles.id matches your auth user ID in Supabase."
      );
    } else if (error === "no-restaurant") {
      toast.error("This account isn't linked to a restaurant yet.");
    } else if (error === "deactivated") {
      toast.error("This account has been deactivated.");
    } else if (error.toLowerCase().includes("identity") || error.toLowerCase().includes("linked")) {
      toast.error(
        "This Google account email already belongs to a password login. Sign in with email/password, or link Google from Settings after logging in."
      );
    } else {
      toast.error(decodeURIComponent(error));
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await loginAction(formData);
      if (result?.error) {
        toast.error(result.error);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
      toast.error(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Log in to manage your restaurant."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-hilaac-gold hover:underline">
            Start a free trial
          </Link>
        </>
      }
    >
      <GoogleAuthButton label="Continue with Google" />
      <AuthDivider />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@restaurant.com"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-hilaac-gold hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}

function LoginFallback() {
  return (
    <AuthShell title="Welcome back" description="Log in to manage your restaurant.">
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-hilaac-gold" aria-hidden="true" />
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
