"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string; status: string; factor_type: string };

export function MfaSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [aal, setAal] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeCode, setRemoveCode] = useState("");

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [listed, assurance] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    const totp = (listed.data?.totp ?? []) as Factor[];
    setFactors(totp);
    setAal(assurance.data?.currentLevel ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startEnroll() {
    setEnrolling(true);
    setBusy(true);
    const supabase = createClient();
    try {
      const listed = await supabase.auth.mfa.listFactors();
      for (const f of listed.data?.all ?? []) {
        if (f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Hilaac Authenticator",
      });
      if (error || !data) {
        toast.error(error?.message ?? "Could not enroll");
        setEnrolling(false);
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
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
        return;
      }
      toast.success("Authenticator added");
      setEnrolling(false);
      setFactorId(null);
      setQr(null);
      setSecret(null);
      setCode("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(e: React.FormEvent) {
    e.preventDefault();
    if (!removeId) return;
    setBusy(true);
    const supabase = createClient();
    try {
      // Re-auth with TOTP before unenroll (step-up).
      const challenge = await supabase.auth.mfa.challenge({ factorId: removeId });
      if (challenge.error || !challenge.data) {
        toast.error(challenge.error?.message ?? "Re-auth failed");
        return;
      }
      const verify = await supabase.auth.mfa.verify({
        factorId: removeId,
        challengeId: challenge.data.id,
        code: removeCode.trim(),
      });
      if (verify.error) {
        toast.error(verify.error.message);
        return;
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: removeId });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Authenticator removed");
      setRemoveId(null);
      setRemoveCode("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          Manage two-factor authentication
        </CardTitle>
        <CardDescription>
          Required for owner and manager accounts. Kitchen, waiter, and cashier logins are not
          prompted for MFA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Session assurance:{" "}
              <span className="font-medium text-foreground">{aal ?? "unknown"}</span>
              {factors.length > 0
                ? ` · ${factors.length} authenticator${factors.length === 1 ? "" : "s"} enrolled`
                : " · No authenticator enrolled yet"}
            </p>

            {factors.map((f) => (
              <div
                key={f.id}
                className="flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{f.friendly_name || "Authenticator app"}</p>
                  <p className="text-xs text-muted-foreground">Status: {f.status}</p>
                </div>
                {removeId === f.id ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setRemoveId(f.id);
                      setRemoveCode("");
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}

            {removeId ? (
              <form onSubmit={removeFactor} className="space-y-3 rounded-lg border border-destructive/30 p-4">
                <p className="text-sm">Enter a current authenticator code to remove this factor.</p>
                <div className="space-y-2">
                  <Label htmlFor="remove-code">Authentication code</Label>
                  <Input
                    id="remove-code"
                    inputMode="numeric"
                    value={removeCode}
                    onChange={(e) => setRemoveCode(e.target.value.replace(/\s/g, ""))}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <BrandButton type="submit" disabled={busy}>
                    Confirm remove
                  </BrandButton>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setRemoveId(null);
                      setRemoveCode("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            {enrolling ? (
              <form onSubmit={confirmEnroll} className="space-y-3 rounded-lg border p-4">
                {qr ? (
                  <div className="flex justify-center bg-white p-3">
                    <Image src={qr} alt="MFA QR" width={180} height={180} unoptimized />
                  </div>
                ) : null}
                {secret ? (
                  <p className="break-all text-center text-xs text-muted-foreground">
                    Secret: <span className="font-mono text-foreground">{secret}</span>
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="enroll-code">Authentication code</Label>
                  <Input
                    id="enroll-code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <BrandButton type="submit" disabled={busy}>
                    Verify factor
                  </BrandButton>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setEnrolling(false);
                      setFactorId(null);
                      setQr(null);
                      setSecret(null);
                      setCode("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <BrandButton type="button" disabled={busy} onClick={startEnroll}>
                {factors.length ? "Add another authenticator" : "Set up authenticator"}
              </BrandButton>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
