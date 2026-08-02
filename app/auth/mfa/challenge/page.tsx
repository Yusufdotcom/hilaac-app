"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        router.replace(next.startsWith("/") ? next : "/admin");
        return;
      }

      const factors = await supabase.auth.mfa.listFactors();
      const totp = factors.data?.totp?.[0];
      if (!totp) {
        router.replace(`/auth/mfa/enroll?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!cancelled) {
        setFactorId(totp.id);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || code.trim().length < 6) return;
    setVerifying(true);
    const supabase = createClient();
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error || !challenge.data) {
        toast.error(challenge.error?.message ?? "Challenge failed");
        return;
      }
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) {
        toast.error(verify.error.message);
        setCode("");
        return;
      }
      router.replace(next.startsWith("/") ? next : "/admin");
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AuthShell
      title="Two-factor verification"
      description="Enter the 6-digit code from your authenticator app to continue."
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-hilaac-gold" />
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Authentication code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              placeholder="123456"
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={verifying || !factorId}>
            {verifying && <Loader2 className="animate-spin" />}
            Verify
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Two-factor verification" description="Loading…">
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-hilaac-gold" />
          </div>
        </AuthShell>
      }
    >
      <MfaChallengeForm />
    </Suspense>
  );
}
