/**
 * App-side transactional email via Resend — same provider as Supabase Auth SMTP.
 * Uses RESEND_API_KEY + EMAIL_FROM already configured for password reset / verification.
 */

export function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from = process.env.EMAIL_FROM?.trim() || "";
  return {
    apiKey,
    from,
    configured: Boolean(apiKey && from),
  };
}

export type SendTransactionalEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendTransactionalEmailResult> {
  const cfg = getResendConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      error: "Email is not configured on the server (missing RESEND_API_KEY or EMAIL_FROM)",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!res.ok || !json.id) {
      return {
        ok: false,
        error: json.message || `Resend HTTP ${res.status}`,
      };
    }

    return { ok: true, id: json.id };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Resend request failed",
    };
  }
}

export async function getResendEmail(id: string): Promise<{
  id?: string;
  to?: string[];
  subject?: string;
  last_event?: string;
  created_at?: string;
} | null> {
  const cfg = getResendConfig();
  if (!cfg.configured || !id) return null;
  const res = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    id?: string;
    to?: string[];
    subject?: string;
    last_event?: string;
    created_at?: string;
  };
}
