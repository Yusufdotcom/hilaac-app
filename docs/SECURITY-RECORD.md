# Hilaac Security Record — Critical & High Findings

**Product:** Hilaac (multi-tenant restaurant SaaS)  
**Stack:** Next.js 14 · Supabase (Postgres + Auth + Storage + Realtime) · Vercel  
**Audit window:** August 2026  
**Working method:** show current code/policy → propose fix → apply → verify against live/remote infrastructure  
**Companion canvas:** Cursor canvas `hilaac-security-audit.canvas.tsx` (exploratory audit UI; this file is the durable status record)

This document is the permanent close-out record for Critical and High findings from the 2026 security audit. Use it for partner diligence, payment-integration questionnaires, and developer onboarding.

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Closed** | Fix applied and live-verified (or build-verified where noted) |
| **Accepted risk** | Intentionally not fully remediated; reasoning and revisit trigger documented |

---

## Critical findings

### C5 — Next.js unpatched (middleware auth bypass class) — **Closed**

| | |
|--|--|
| **Finding** | `next@14.2.5` lagged patched 14.2.x releases that include middleware authentication bypass fixes (CVE-2025-29927 class, fixed from 14.2.25+). |
| **Change** | Upgraded `next` and `eslint-config-next` to **14.2.35**. |
| **Verify** | Version pin + `/admin` / `/staff` unauthenticated redirect to `/login`; production build later reconfirmed on 14.2.35. |

### C3 — Payment webhooks + `/api/payments/charge` unauthenticated — **Closed**

| | |
|--|--|
| **Finding** | Webhooks and charge path could be abused with service-role / merchant key use without proof of request authenticity. |
| **Change** | Fail-closed HMAC webhook auth (`lib/payments/webhook-auth.ts`); charge requires short-lived HMAC order token (`lib/payments/charge-token.ts`). |
| **Verify** | Acceptance scripts (unsigned/bad sig → 401; valid auth paths exercised). |

### C1 — Orders RLS too broad (7-day anon/authenticated SELECT) — **Closed**

| | |
|--|--|
| **Finding** | Customer order SELECT was time-window based, not order-bound — cross-tenant / bulk read risk. |
| **Change** | Dropped broad recent-order policies; customer track via authenticated API (`GET /api/orders/[id]/track`) with service role behind app auth (later tightened further by H2 tokens). |
| **Verify** | Live RLS / route checks that UUID-only anonymous dumps are not available. |

### C4 — Cron fail-open when `CRON_SECRET` unset — **Closed**

| | |
|--|--|
| **Finding** | Job routes could run without a configured secret. |
| **Change** | Fail-closed: missing/invalid `CRON_SECRET` → reject. |
| **Verify** | Unauthenticated / wrong-secret job calls rejected. |

### C2 — Encrypted merchant columns readable by authenticated — **Closed**

| | |
|--|--|
| **Finding** | `*_encrypted` payment credential columns were selectable under restaurant policies by `authenticated` / `anon`. |
| **Change** | Column-level `REVOKE SELECT` from `authenticated`/`anon`; service role only for decrypt paths. |
| **Verify** | Live privilege check: authenticated/anon SELECT on encrypted columns = **false**. |
| **Residual note** | Table-level INSERT/UPDATE on those columns for authenticated may still exist; SELECT was the critical leak. Revisit if grants are broadened. |

---

## High findings

Fix order executed: **H2 → H5 → H1 → H7 → H4 → H3 → H6 → H8**.

### H2 — `confirm-payment` + `track` IDOR by order UUID — **Closed**

| | |
|--|--|
| **Finding** | Service-role routes callable with only order UUID knowledge. |
| **Change** | Shared `authorizeOrderAccess` — HMAC order/access token or staff session (`owner`/`manager`/`cashier`) for restaurant. Tokens minted on order create; clients store in sessionStorage. |
| **Key files** | `lib/payments/authorize-order-access.ts`, `lib/payments/charge-token.ts`, confirm/track routes, cart/status clients. |
| **Verify** | `scripts/verify-h2-order-access.mjs` — 5/5. |
| **Follow-up** | Charge-token remint when expired (logged; not implemented). |

### H5 — `test-connection` missing role + tenant gate — **Closed**

| | |
|--|--|
| **Finding** | Any authenticated user could POST merchant credentials for testing. |
| **Change** | Require `owner`/`manager` and restaurant ownership / primary profile match (same pattern as settings). |
| **Verify** | `scripts/verify-h5-test-connection.mjs` — 5/5. |

### H1 — `anon_can_insert_orders` WITH CHECK too weak — **Closed**

| | |
|--|--|
| **Finding** | Policy only checked `auth.role() = 'anon'`. |
| **Change** | WITH CHECK: active restaurant + (null table OR table belongs to `orders.restaurant_id`). Migration `20250801180000_harden_anon_insert_orders.sql`. |
| **Verify** | `scripts/verify-h1-anon-insert.mjs` — 4/4. Menu item binding remains on `POST /api/orders` (anon cannot insert `order_items`). |

### H7 — Storage uploads not path-scoped by restaurant — **Closed**

| | |
|--|--|
| **Finding** | Authenticated users could write anywhere in shared buckets. |
| **Change** | `can_write_restaurant_storage(object_name)` — path prefix `{restaurant_id}/…` + manager/owner (or owned restaurant). Migration `20250801181000_storage_path_restaurant_scope.sql`. |
| **Verify** | `scripts/verify-h7-storage-scope.mjs` — 4/4. |

### H4 — No staff deactivation / session invalidation — **Closed**

| | |
|--|--|
| **Finding** | No `profiles.is_active`; removal did not kill auth sessions. |
| **Change** | `profiles.is_active`; `get_my_restaurant_id()` + `is_staff()` require active; middleware signs out inactive on `/admin`/`/staff`; `PATCH /api/admin/staff/[id]/status` sets flag + `auth.admin.updateUserById({ ban_duration })` / `"none"` to unban. Owners cannot be deactivated via API/RLS. Staff Accounts UI on admin staff page. |
| **Migrations** | `20250802080000_profiles_is_active.sql`, `20250802081000_is_staff_requires_active.sql`. |
| **Verify** | `scripts/verify-h4-staff-active.mjs` — 16/16 (including inactive session → `/staff` 307 → login). |

### H3 — Twilio WhatsApp webhook unsigned — **Closed**

| | |
|--|--|
| **Finding** | Inbound WhatsApp webhook wrote opt-outs with no signature check; errors swallowed as `{ ok: true }`. |
| **Change** | Fail-closed `twilio.validateRequest` (`lib/whatsapp/webhook-auth.ts`); 401 on auth failure; **500** on opt-out DB failure (Twilio retries). Prefer env `TWILIO_WHATSAPP_WEBHOOK_URL` = exact Console callback URL. |
| **Verify** | `scripts/verify-h3-twilio-webhook.mjs` — 10/10. |

### H6 — Plaintext phone logging — **Closed**

| | |
|--|--|
| **Finding** | Reminder + WhatsApp dry-run logged full phones (and message/variables). |
| **Change** | `maskPhoneForLog` → `+252******4696`; reminder omits message body; dry-run logs variable **keys** only. |
| **Verify** | `scripts/verify-h6-mask-phone.mjs` — live masked log lines. |

### H8 — Dependency advisories (`xlsx`, `postcss`, `glob`, `minimatch`) — **Closed with accepted risks**

| Package | Decision | Reasoning |
|---------|----------|-----------|
| **xlsx@0.18.5** | **Accepted risk** (write-only) | Advisories are parse-time (prototype pollution / ReDoS). Hilaac only **generates** workbooks in `components/admin/reports/export-utils.ts` — no `XLSX.read` of uploads. No patched release on public npm. |
| **postcss** (direct) | **Patched** | Bumped to **≥8.5.18** (installed `^8.5.25`). `npm run build` succeeded. |
| **postcss** (nested under `next`) | **Accepted risk** | Build-time; clearing requires Next major or overrides — not taken. |
| **glob** (via eslint-config-next) | **Accepted risk** | Lint/build CLI command-injection class; not on customer request path. |
| **minimatch** | **No action** | Not present in current `npm audit` highs. |

**xlsx revisit trigger (mandatory):** If you are adding a feature that parses/reads user-uploaded `.xlsx` files, **STOP** — this changes the risk profile that made accepting CVE-2023-30533 and CVE-2024-22363 safe. Re-evaluate before proceeding: patch (SheetJS CDN ≥0.20.2), swap to ExcelJS, or otherwise mitigate. Enforced by the comment at the top of `export-utils.ts`.

---

## Accepted risks (summary)

1. **xlsx write-only usage** — see H8; trigger = any feature that parses/reads user-uploaded `.xlsx` (CVE-2023-30533 / CVE-2024-22363).  
2. **Next-nested postcss + tooling glob** — build/lint only; revisit on Next major upgrade or if a fully green audit is required for external reporting.  
3. **C2 residual** — SELECT revoked; watch INSERT/UPDATE grants on encrypted columns if schema/grants change.  
4. **Charge-token remint** — expired tokens require new order today (product follow-up, not an open Critical).

---

## Ongoing security hygiene (not a substitute for periodic audits)

This audit was a **one-time deep pass**. New work (loyalty, WhatsApp, reports, payments, staff) should use the same default for anything touching **auth, payments, or cross-tenant data**:

1. **Show** the current code/policy  
2. **Propose** the fix  
3. **Apply** only after agreement  
4. **Verify live** (remote DB / HTTP / scripts) — do not trust summaries alone  

Prefer fail-closed secrets, tenant checks on every service-role path, and never log raw PII.

---

## Verification scripts (repo)

| Script | Finding |
|--------|---------|
| `scripts/verify-h2-order-access.mjs` | H2 |
| `scripts/verify-h5-test-connection.mjs` | H5 |
| `scripts/verify-h1-anon-insert.mjs` | H1 |
| `scripts/verify-h7-storage-scope.mjs` | H7 |
| `scripts/verify-h4-staff-active.mjs` | H4 |
| `scripts/verify-h3-twilio-webhook.mjs` | H3 |
| `scripts/verify-h6-mask-phone.mjs` | H6 |
| `scripts/verify-c3-*.mjs` / acceptance | C3 |

---

## Auth additions (2026-08-02)

Staff/owner auth now includes TOTP MFA (owner/manager only), password reset via Custom SMTP, and Google OAuth. See `docs/AUTH-SETUP.md` for env, redirects, and verification checklist. Customer QR ordering remains anonymous.

*Last updated: 2026-08-02 — Criticals C5→C3→C1→C4→C2 and Highs H2→H8 closed or accepted as documented above; staff auth MFA/OAuth/reset added.*
