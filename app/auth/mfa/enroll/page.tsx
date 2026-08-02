"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function MfaEnrollForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
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

      // Drop stale unverified factors from abandoned enrollments
      const listed = await supabase.auth.mfa.listFactors();
      const unverified = listed.data?.all?.filter((f) => f.status !== "verified") ?? [];
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Hilaac Authenticator",
      });
      if (cancelled) return;
      if (error || !data) {
        toast.error(error?.message ?? "Could not start MFA enrollment");
        setLoading(false);
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
      toast.success("Two-factor authentication enabled");
      router.replace(next.startsWith("/") ? next : "/admin");
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AuthShell
      title="Set up two-factor authentication"
      description="Owner and manager accounts require an authenticator app. Scan the QR code, then enter a 6-digit code."
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-hilaac-gold" />
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          {qr ? (
            <div className="flex justify-center rounded-xl border bg-white p-4">
              {/* qr_code is a data URL from Supabase */}
              <Image src={qr} alt="MFA QR code" width={200} height={200} unoptimized />
            </div>
          ) : null}
          {secret ? (
            <p className="break-all text-center text-xs text-[#64748B]">
              Can&apos;t scan? Enter this secret: <span className="font-mono text-[#0F172A]">{secret}</span>
            </p>
          ) : null}
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
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={verifying || !factorId}>
            {verifying && <Loader2 className="animate-spin" />}
            Verify and continue
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function MfaEnrollPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Set up two-factor authentication" description="Loading…">
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-hilaac-gold" />
          </div>
        </AuthShell>
      }
    >
      <MfaEnrollForm />
    </Suspense>
  );
}
