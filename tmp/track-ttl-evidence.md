# Order track token TTL — evidence (before fix)

## Source: `lib/payments/charge-token.ts`

| Token | Constant | TTL | Used for |
|-------|----------|-----|----------|
| Charge | `DEFAULT_TTL_SEC` | **15 minutes** (`15 * 60`) | API charge + USSD confirm |
| Access | `ORDER_ACCESS_TTL_SEC` | **24 hours** (`24 * 60 * 60`) | `GET /api/orders/[id]/track` |

Mint path on order create (`app/api/orders/route.ts`): both `mintChargeToken` and `mintOrderAccessToken`.

Verify path: `verifyChargeToken` rejects when `exp < now` → reason `"expired"`.

## Storage (the live footgun)

`lib/order/order-access-storage.ts` stores tokens in **sessionStorage** only.
Closing the tab/browser clears tokens even while the HMAC access token is still valid (up to 24h).

`loadOrderAccessToken` falls back to the **15-minute charge token** if access is missing — so after ~15 minutes with only charge saved, track fails with `expired`.

## Auth failure statuses (current)

Missing/invalid/expired token → **401** (not 404) from `authorizeOrderAccess`.
True **404** only if order row missing (`Order not found`).

UI: `OrderPreparingScreen` always appends “Hubi internetkaaga…” under any error — misleading for auth failures.
