# Hilaac — Restaurant SaaS Platform

Hilaac is a multi-tenant restaurant SaaS platform: QR ordering, a real-time kitchen/waiter/cashier
suite, an admin panel with AI menu generation, and mobile money payments (EVC Plus / eDahab) via
either manual USSD or direct API integration.

Built with **Next.js 14 (App Router)**, **Supabase** (Auth, Postgres, Realtime, Storage), **Tailwind
CSS**, and **shadcn/ui**.

## 1. Install dependencies

```bash
npm install
```

## 2. Create a Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run the entire contents of [`supabase/schema.sql`](./supabase/schema.sql).
   This creates every table, enum, RLS policy, storage bucket, and helper function (including the
   `create_restaurant_and_owner` and `create_demo_restaurant` onboarding RPCs).
3. In **Project Settings → API**, copy your Project URL, anon key, and service role key.

## 3. Configure environment variables

Copy `.env.local.example` to `.env.local` (already scaffolded for you) and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=          # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # anon/public key
SUPABASE_SERVICE_ROLE_KEY=         # service role key — server-only, never expose to the client
NEXT_PUBLIC_APP_NAME="Hilaac"
NEXT_PUBLIC_APP_URL=https://hilaac.so   # used to build the QR-code ordering link
OPENAI_API_KEY=                    # for the AI menu image generator (Pro/trial only)
ENCRYPTION_SECRET_KEY=             # 32-byte hex string or any passphrase, used for AES-256-GCM
CRON_SECRET=                       # shared secret Vercel Cron sends as `Authorization: Bearer`
EVC_API_BASE_URL=                  # EVC Plus merchant API base URL (payment_mode = 'api')
EDAHAB_API_BASE_URL=               # eDahab merchant API base URL (payment_mode = 'api')
```

Generate a strong `ENCRYPTION_SECRET_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000`.

- **Public landing page**: `/`
- **Sign up / start a trial**: `/signup`
- **Admin panel**: `/admin/[slug]/dashboard` (owner/manager only)
- **Customer ordering flow**: `/order/[slug]`
- **Staff dashboards**: `/staff/[slug]/kitchen`, `/staff/[slug]/waiter`, `/staff/[slug]/cashier`

## 5. Deploying (Vercel)

`vercel.json` already declares the three scheduled jobs:

| Path                            | Schedule         | Purpose                                             |
| -------------------------------- | ----------------- | ---------------------------------------------------- |
| `/api/jobs/trial-expiration`     | nightly (00:00)   | Downgrades expired trials to `starter` + forces USSD |
| `/api/jobs/payment-reminders`    | daily (08:00)     | SMS/WhatsApp reminder 3 days before expiry           |
| `/api/jobs/demo-cleanup`         | hourly            | Deletes expired "Try Demo" restaurants               |

Set `CRON_SECRET` in your Vercel project's environment variables — Vercel automatically sends it
back as `Authorization: Bearer <CRON_SECRET>` on every cron invocation, which these routes verify.

## Architecture notes

- **Multi-tenancy & RLS**: every tenant-owned table is scoped by `restaurant_id` and locked down
  with Postgres row-level security (see `supabase/schema.sql`). Staff can only ever read/write their
  own restaurant's rows. `restaurants` uses **column-level grants** (not just RLS) so the anon/public
  key can never select the encrypted merchant credential columns, even by accident.
- **Orders are never written or read directly by the browser.** Placing an order goes through
  `POST /api/orders`, and status polling goes through `GET /api/orders/[id]/track` — both run with
  the service role so prices are recomputed server-side (never trusting a client-supplied total) and
  no tenant's order data can be enumerated via the anon key.
- **Encryption**: `lib/encryption.js` implements AES-256-GCM for merchant IDs/API keys. Keys are only
  ever decrypted in memory, inside trusted server routes (`/api/payments/charge`), immediately before
  calling the provider — never logged, never returned to the client.
- **Subscription gates**: `lib/constants.ts` (`canUseAiFeatures`, `canUseApiPayments`) gate the AI
  menu generator and API payment mode to the `pro` tier and active trials. `middleware.ts` redirects
  expired subscriptions straight to `/admin/[slug]/billing`.
- **Realtime**: staff dashboards subscribe to `postgres_changes` on `orders`/`order_items` (RLS-scoped
  to their restaurant) via `lib/hooks/use-realtime-orders.ts`. The customer-facing order tracker polls
  the public tracking endpoint instead, since it has no authenticated session.

## Project structure

```
app/
  page.tsx                     # Public landing page
  signup/, login/               # Auth
  admin/[slug]/                 # Owner/manager dashboard (dashboard, menu, tables, orders, settings, billing)
  order/[slug]/                 # Customer ordering flow (mobile-first)
  staff/[slug]/                 # kitchen/, waiter/, cashier/
  api/
    admin/menu/generate-image/  # AI menu image generator (Pro/trial gated)
    admin/restaurant/           # settings, test-connection, status
    admin/subscriptions/        # confirm-payment (manual USSD upgrade)
    orders/                     # create + track (service-role backed)
    payments/charge/            # Smart payment router (EVC/eDahab API mode)
    webhooks/evc/, webhooks/edahab/
    jobs/                       # Vercel Cron targets
components/
  ui/                            # shadcn/ui primitives
  admin/, order/, staff/, auth/, landing/
lib/
  supabase/                      # browser/server/middleware clients
  encryption.js                  # AES-256-GCM
  payments/providers.ts          # EVC/eDahab adapters
  hooks/use-realtime-orders.ts
supabase/schema.sql               # Full DB schema + RLS
```
