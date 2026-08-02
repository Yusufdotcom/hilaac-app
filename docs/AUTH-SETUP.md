# Auth setup (MFA · Password reset · Google)

Production app URL: `https://hilaacapp.so`  
Supabase project: `ochbvlyunefjatwoxqup`  
Callback: `https://ochbvlyunefjatwoxqup.supabase.co/auth/v1/callback`

## Vercel / local env

Set (Production + Preview as needed):

```bash
NEXT_PUBLIC_APP_URL=https://hilaacapp.so
```

Local `.env.local` for reset/OAuth redirects while developing:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

SMTP is configured in the **Supabase Dashboard** (Resend). Optional app-side vars:

```bash
RESEND_API_KEY=re_...
EMAIL_FROM=Hilaac <onboarding@resend.dev>
```

## Email templates (do after deploy)

Supabase → **Authentication → Email Templates**

Brand colors: navy `#0F172A`, gold `#D4A373`. Keep `{{ .ConfirmationURL }}` / `{{ .Token }}` placeholders.

Suggested Reset Password button style:

```html
<a href="{{ .ConfirmationURL }}"
   style="background:#D4A373;color:#0F172A;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
  Reset password
</a>
```

## Google identity linking

If a password account already exists for an email and Google sign-in fails to link:

1. Supabase → **Authentication → Providers → Google** — ensure enabled  
2. **Authentication → Settings** — review “Enable manual linking” / automatic identity linking options for your project  
3. User can sign in with password; linking Google from account settings can be added later  

## MFA behavior

| Role | MFA |
|------|-----|
| owner / manager | Enroll on first admin access; challenge each aal1 session; AAL2 required for payment settings + order export with phones |
| kitchen / waiter / cashier | Never prompted |

## Manual verification checklist

1. Owner login → MFA enroll (QR) → dashboard  
2. Owner logout/login → MFA challenge (not enroll again)  
3. Waiter/kitchen/cashier login → **no** MFA screens  
4. Forgot password → Resend email arrives → set new password → login  
5. Google new user → complete-signup (restaurant name) → MFA enroll → dashboard  
6. Google returning user → MFA challenge (if enrolled) → dashboard  
