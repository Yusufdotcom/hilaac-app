# Admin color audit (exhaustive code sweep)

Scanned `app/admin/**` + `components/admin/**` (44 files).

## Fixed this pass (now use `--admin-brand`)

| Surface | Was | Now |
|---------|-----|-----|
| Dashboard awaiting-payment banner | amber-50/700 | `adminBrandCalloutClass` + brand CTA |
| Dashboard 4 stat icons | `bg-primary/10 text-primary` (gold) | `adminBrandIconWellClass` |
| Menu item prices | `text-primary` | `adminBrandTextClass` |
| Add-on prices | `text-muted-foreground` | `adminBrandTextClass` |
| Top-pick star toggle | `text-amber-500` | brand text |
| Billing Crown / plan checks | amber / primary | brand |
| Loyalty Gift icon | amber-500 | brand |
| Insights Lightbulb header | amber-500 | brand |
| Settings payment-test success | hilaac-gold | brand |
| Staff Access focus ring | `#D4A373` | brand ring |

## Remaining non-brand colors — intentional keep

### Semantic status / payment (Orders) — keep
- `awaiting_payment` orange badges
- `preparing` / `pending_cashier_confirmation` amber badges
- `paid` / `ready` / `completed` emerald
- `cancelled` / `failed` red
- Confirm payment button emerald; Cancel/void red

### Semantic warnings — keep
- Staff Dashboard Access info callout (amber) — security warning
- WhatsApp dry-run / not-configured callout (amber)
- Insights severity `underperforming` (amber-600)
- Trial expiry destructive badge when ≤2 days

### Product identity — keep
- Reports pie `eDahab: #D4A373` (payment method color, not restaurant brand)
- Shell mobile menu icon fallback `#D4A373` only inside `var(--admin-brand, …)` chain

### Pages with no remaining hardcoded brand-accent candidates
Dashboard (after fix), Menu (prices), Tables, Orders (actions use BrandButton; badges semantic), Reports charts (use `useAdminBrandColor` for series), Settings cards (BrandButton / BrandRadio), Billing (after Crown fix), Staff hub tabs.

## Screenshots
See `tmp/admin-design-evidence/pages/` (probe with live Baba brand `#9E2E2E`).
