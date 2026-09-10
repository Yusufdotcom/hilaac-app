# Hilaac — Full System Transformation: Cursor Implementation Prompt

You are working on **Hilaac** — a live, production, multi-tenant SaaS platform at **hilaacapp.so**. Real restaurants are using it right now with real money flowing through it. Every change must be additive and backwards-compatible. Nothing breaks. If a step could break something, that step is wrong — stop and ask.

---

## CURRENT SYSTEM (what exists today — do not break any of this)

### Tech stack
- Next.js 14.2.35 (App Router) + React 18 + TypeScript
- Supabase (Postgres + Auth + Storage + Realtime + RLS)
- Vercel (hosting, cron jobs)
- Tailwind CSS + shadcn/ui (Radix UI primitives)
- Twilio (WhatsApp), OpenAI via `ai` + `@ai-sdk/gateway`
- Recharts (charts), jspdf + html2canvas + xlsx (exports)
- EVC / eDahab USSD payments (AES-256 encrypted merchant credentials)

### What's live and verified
- QR-based ordering flow: customer scans → table → menu → cart → order
- Order status page: 4-step stepper, loyalty progress, mini-game, dark/light mode, cart persistence
- Kitchen / Waiter / Cashier staff dashboards with Supabase Realtime
- **Accept checkpoint**: Waiter or Cashier confirms guest is present before Kitchen sees the order — do not bypass this in any new order path
- Payment flow: EVC/eDahab USSD, cashier confirmation, API auto-confirm (Pro tier)
- Role-based access: owner / manager / kitchen / waiter / cashier, MFA, 18min/60min idle timeout, is_active on every API route
- Security: C1–C5 Critical + H1–H8 High + N2–N4 all closed — do not touch orders/payments/middleware without explicit justification
- Admin panel: Dashboard, Menu (Categories→Add-ons→Menu Items), Tables, Orders (detail modal with Confirm/Update/Cancel), Reports (KPIs, charts, PDF+Excel export, story-style recap overlay), Staff (Accounts/Dashboard Access/Waiter Names), Settings (brand color, business hours, payment rules, loyalty, WhatsApp), Billing
- Multi-tenant platform at `/platform`: tenant list with plan/status/days remaining, Pending Renewals, Platform Settings (Hilaac's own payment codes), Support "Open" session with banner
- Subscription: Starter $29 / Pro $79, USSD renewal, plan switching
- Brand color system: each restaurant has its own color, applied via CSS token throughout admin + customer flow
- Dark/light mode: fully working across entire admin panel
- Reporting RPCs: `get_kpi_summary`, `get_revenue_by_period`, `get_top_items`, `get_least_ordered_items`, `get_peak_hours`, `get_payment_split`, `get_waiter_performance`
- Recap story overlay on Reports page (Weekly + Monthly, auto-advancing slides, reuses existing mini-game component)

### Current live tenants
- `baba-s-grill-and-cafe` — Pro, active
- `boba-hergeisa` — Pro, active  
- `hilaac-safari` — Pro, active

---

## WHAT WE'RE BUILDING

Transform Hilaac from a restaurant QR-ordering system into a **full business intelligence platform for restaurants**, architecturally ready to expand to retail and other business types. An owner opens Hilaac, asks "how is my business doing?" and gets a real grounded answer — sales, profit, inventory, staff performance, customer trends — conversationally through an AI chatbot, not just as charts.

---

## STEP 1 — New 3-tier subscription model (safe migration, follow exactly)

Replace Starter/Pro with:
- **Goronyo 1.0** — $15/mo (small restaurants)
- **Gorgor 1.0** — $30/mo (growing restaurants)
- **Galeyr 1.0** — $60/mo (serious operators)

### Feature gates per tier

**Goronyo 1.0:**
QR ordering, Kitchen/Waiter/Cashier dashboards, manual USSD payment, loyalty, WhatsApp notifications, up to 3 staff accounts, basic reports

**Gorgor 1.0** (everything in Goronyo plus):
API auto-payment, AI menu image generator, unlimited staff accounts, inventory + smart reorder (when built), menu profitability (when built), unified alerts center, multi-branch comparison, recap email delivery

**Galeyr 1.0** (everything in Gorgor plus):
AI Business Chatbot (exclusive — never allow on lower tiers), expenses/P&L, staff performance + scheduling, customer intelligence, cross-branch benchmarking

### Safe migration sequence — follow every step, do not skip or reorder

**Step 1.1 — Audit before touching anything**
Find every place in the codebase that reads `subscription_tier`, checks `=== 'pro'`, `=== 'starter'`, or calls any tier-gating helper. List file + line + what it gates. Show me this list before proceeding.

**Step 1.2 — Write rollback script first**
SQL that restores all 3 restaurants to their current exact tier + subscription_end_date. Test it. Show me it works. Do not proceed until this exists.

**Step 1.3 — Add new values without removing old**
`ALTER TYPE subscription_tier ADD VALUE 'goronyo'` etc. (or widen check constraint). `starter` and `pro` remain valid. No restaurant's actual data changes yet.

**Step 1.4 — Build capability mapping**
Create `lib/billing/tier-capabilities.ts`. Map old values too:
- `starter` → Goronyo capabilities (existing Starter customers unchanged)
- `pro` → Galeyr capabilities (existing Pro customers keep everything they have — never take away a paid feature during migration)
- `goronyo` / `gorgor` / `galeyr` → new capability sets

**Step 1.5 — Refactor all gates to use capability mapping**
Replace every direct `tier === 'pro'` check with `canUseFeature(tier, 'feature_name')`. Fail-safe: unknown tier → most permissive, log loudly. Never lock out a paying customer due to a billing edge case.

**Step 1.6 — Update UI (still no data migration)**
- Billing page: 3 cards (Goronyo/Gorgor/Galeyr) with correct prices, feature lists, action buttons (Renew/Switch). Reuse existing USSD payment flow for all 3 tiers.
- Platform dashboard: Plan column shows correct tier name for all values including legacy
- Landing page: 3 pricing cards

**Step 1.7 — Migrate one restaurant at a time with soak periods**
- First: `hilaac-safari` → `goronyo` (lowest blast radius). Verify, wait 24 hours.
- Second: `boba-hergeisa` → `gorgor`. Verify, wait 24 hours.
- Third: `baba-s-grill-and-cafe` → `galeyr`. Verify.
- **Never change subscription_end_date during migration**
- **Confirm with me before running each migration on production**

**Step 1.8 — Remove legacy values (only after 1-2 weeks stable)**
Only then remove `starter`/`pro` from enum and capability mapping.

### Verification checklist (run after every sub-step)
For each of the 3 restaurants:
- [ ] Owner can log in and reach Dashboard
- [ ] A test order can be placed end-to-end
- [ ] Kitchen/Waiter/Cashier dashboards load with real data
- [ ] Billing page renders with correct tier, working buttons
- [ ] Platform dashboard lists restaurant correctly
- [ ] subscription_end_date unchanged from Step 1.2 record

---

## STEP 2 — Database foundations (additive only, no breaking changes)

Run these migrations. Each is nullable or has a default so existing data is unaffected.

### 2.1 Cost price on menu items
```sql
ALTER TABLE menu_items ADD COLUMN cost_price NUMERIC;
```
Nullable intentionally — restaurants fill it in when ready. Unlocks: profitability matrix, food cost %, gross margin.

### 2.2 Expenses table
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('rent','utilities','labor','supplies','other')),
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurant_isolation" ON expenses
  USING (restaurant_id = get_my_restaurant_id());
```

### 2.3 Inventory items table
```sql
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  current_stock NUMERIC DEFAULT 0,
  daily_usage_estimate NUMERIC,
  reorder_level NUMERIC,
  supplier_delivery_days INTEGER DEFAULT 2,
  cost_per_unit NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurant_isolation" ON inventory_items
  USING (restaurant_id = get_my_restaurant_id());
```
Computed `days_remaining = current_stock / NULLIF(daily_usage_estimate, 0)` — calculate at query time, not stored.

### 2.4 Customer profiles view
```sql
CREATE VIEW customer_profiles AS
SELECT
  restaurant_id,
  customer_phone,
  COUNT(*) AS total_visits,
  SUM(total) AS lifetime_spend,
  MAX(created_at) AS last_visit,
  MIN(created_at) AS first_visit
FROM orders
WHERE customer_phone IS NOT NULL
  AND status != 'cancelled'
GROUP BY restaurant_id, customer_phone;
```

### 2.5 Multi-currency support
```sql
ALTER TABLE restaurants 
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN currency_rate NUMERIC DEFAULT 1;
```
SOS (Somali Shilling) is the priority — Somalia's actual local currency. Exchange rate configurable in Platform Settings.

### 2.6 Business type field (retail-readiness, no behavior change yet)
```sql
ALTER TABLE restaurants 
  ADD COLUMN business_type TEXT NOT NULL DEFAULT 'restaurant';
```
No UI or logic changes. Just future-proofing the schema so retail expansion doesn't need a breaking migration later.

### 2.7 Staff hourly rate (for labor cost calculation)
```sql
ALTER TABLE profiles ADD COLUMN hourly_rate NUMERIC;
```

### Verify after all migrations
- All 3 restaurants load their admin panels correctly
- No existing RLS policies broken
- Orders/payments flow untouched

---

## STEP 3 — Admin panel redesign (apply to every page consistently)

### 3.1 Dashboard — full redesign
Replace the current plain-title Dashboard with:

**Top row — greeting + date**
"Good [morning/afternoon/evening], [owner name]" + "Today, [date]"

**Second row — 2 cards side by side**
Left: Business Health Score card
- Compute 0–100: revenue trend vs last period (40pts) + order volume trend (30pts) + payment backlog severity (30pts, fewer pending = more points)
- Large bold number, status pill (HEALTHY green / NEEDS ATTENTION amber / CRITICAL red), one-sentence plain-English explanation, horizontal progress bar
- Every number must come from a real RPC call — never hardcode or estimate

Right: Today's Tip card
- Dark gradient background (distinct visual — this is AI-generated)
- Pull from existing Insights engine (the same rule-based system already powering Reports Insights)

**Third row — 4 KPI stat cards with sparklines**
Orders Today / Revenue Today / Active Tables / Open Orders
Each card: label → large number → 7-bar sparkline chart (using last 7 days of daily data) → % vs yesterday

**Awaiting-confirmation banner** — keep exactly as-is, unchanged

**Top Alerts preview** — 2-3 most urgent alerts (once Alerts center built in Step 4), with "View all →" link

**Quick-link row** — 4 icon+arrow cards: Orders (X pending) / Reports / Menu (X items) / Staff

**Today's Orders live list** — keep exactly as-is, unchanged

### 3.2 Apply consistent design patterns across every admin page
- **Contextual color**: red = bad metric (waste, owed amount, losses), green = good metric (profit, growth) — not just "up=green, down=red"  
- **Action buttons only where action is needed** — don't show a button on every table row, only rows that need one
- **Icon in top-right corner of KPI cards** where severity matters (warning triangle for low stock, clock for expiry)
- **"Best option" always labeled + star** — never rely on color alone (gold star + "Cheapest" label together, not color alone)
- **Page-intro subtitle** on every page matching the existing pattern ("Set up categories and add-ons first, then build menu items")

### 3.3 Personalized greeting
Already specified in Dashboard above. Also: show owner's profile photo (already uploadable via avatar menu) in the TopBar avatar.

---

## STEP 4 — Unified Alerts center (new nav item)

New page `/admin/[slug]/alerts` in the sidebar between Reports and Staff.

Single stacked list of severity-tinted cards:
- **🔴 Urgent** — red background tint, red dot, "URGENT" bold caps label, description, "Why it matters:" sentence, action button
- **🟠 Important** — amber background tint, same structure
- **🟢 Normal** — green background tint, same structure

Show count badge on sidebar nav item.

Consolidate these signals (pull from existing data, no new queries needed):
- Orders awaiting confirmation > 2 hours (urgent)
- Subscription expiring within 7 days (important)
- Revenue down > 20% vs same period last week (important)
- Low stock items (once inventory built)
- Low margin items (once cost_price filled in)

Dashboard shows 2-3 top alerts as preview, "View all →" links to this page.

---

## STEP 5 — Menu Intelligence (Gorgor 1.0+)

Add a new "Menu Intelligence" tab to the existing Menu page (Categories → Add-ons → Menu Items → **Menu Intelligence**).

Only visible when restaurant has cost_price filled in for at least one item. Show a notice for restaurants that haven't set cost prices yet.

### 5.1 4 classification summary cards
Stars / Sellers / High Profit / Slow — each with a colored dot matching the product cards below:
- Stars = dark green dot, "High sales + high profit"
- Sellers = teal dot, "High sales + low profit"
- High Profit = lime dot, "Low sales + high profit"
- Slow = gray dot, "Low sales + low profit"

### 5.2 Product cards grid
One card per menu item, sorted by classification:
- Classification badge (color-matched to summary cards)
- 2×2 data grid: Units sold / Revenue / Cost / Est. Profit
- Est. Profit in bold green — the only value colored on the card
- Margin % + trend arrow (↗ green / ↘ red / — flat) at the bottom
- Trend arrow is independent from classification — a "Sellers" item can have a declining margin trend

### 5.3 Summary card at bottom
"✨ Menu Intelligence" with sparkle icon (signals AI-generated section):
- Most ordered: [item] ([units] units)
- Most profitable: [item] ($[profit] · [margin]% margin)
- Least profitable: [item] ([margin]% margin)

Classification logic:
- High sales threshold: above median order volume for this restaurant
- High profit threshold: margin > 40%

---

## STEP 6 — Inventory + Smart Reorder (Gorgor 1.0+)

New nav item `/admin/[slug]/inventory` between Tables and Orders.

### 6.1 Top KPI cards (with severity icons)
Total Inventory Value ($) / Low Stock Items (⚠️ amber icon) / Out of Stock (📦 red icon) / Slow Moving Items (🕐 gray icon)

### 6.2 Three tabs

**"Inventory" tab** — table view:
Columns: Product | Current Stock | Daily Sales | Days Remaining | Reorder Level | Status
- Status pill: Good (green) / ⚠️ Reorder (amber) / Out of stock (red)
- "Order Now" button appears ONLY on rows with Reorder or Out of stock status — not on every row

**"Smart Reorder" tab** — card grid:
Only items needing action. Each card:
- Item name + status badge
- 2×2 grid: Current Stock / Expected usage/day / Supplier delivery / Recommended order
- Recommended order in bold brand color: `(daily_usage × delivery_days) + reorder_level - current_stock`
- Full-width "Add to Order" button

**"Waste / Loss" tab** — table view:
- Monthly Waste total in red (it's always a bad metric)
- AI insight if waste is trending up
- Table: Product | Amount wasted | $ Loss (in red)
- "+ Log Waste" button to add entries using Phase 2.2 data

---

## STEP 7 — Expenses / P&L (Galeyr 1.0)

New nav item `/admin/[slug]/expenses` between Inventory and Staff.

### 7.1 Two tabs

**"Profitability" tab:**
- Monthly Expense total + % vs last month (in red if up)
- P&L waterfall using proportional-width horizontal bars:
  - Revenue (green, full width = 100% baseline)
  - Cost of Goods (red, proportional to revenue)
  - Labor (red, proportional)
  - Operating Expenses (red, proportional)
  - Est. Profit (green, proportional)
- Below bars: Gross Margin / Net Margin / Food Cost % / Labor % in 2×2 grid
- AI insight: "The biggest increase came from [category]"

**"Expenses" tab:**
- "+ Add Expense" button
- Monthly bar chart of expenses over time
- Expense list with category, amount, date, note, delete option

---

## STEP 8 — Staff Performance (Galeyr 1.0)

Add to existing Staff page as new content below the existing Accounts section.

### 8.1 Performance table (derives from existing order + delivery data)
Columns: Name | Role | Sales attributed | Orders | Hours worked | Attendance (progress bar) | Overtime
- Attendance shown as a horizontal progress bar + percentage (not plain text)
- Sales/Orders only populated when attribution data exists

### 8.2 Schedule grid
7-column card grid (Mon–Sun), each column showing 2-3 shift blocks:
- Time range (small gray) on top
- Staff member name (bold) below
- Variable number of shifts per day supported
- "+ Add Shift" functionality

---

## STEP 9 — Customer Intelligence (Galeyr 1.0)

New nav item `/admin/[slug]/customers` between Expenses and Staff.

### 9.1 KPI cards
Total Customers / New (this month) / Returning / Avg Spend

### 9.2 Segment bars (4 segments with colored horizontal bars)
VIP (green) / Regular (teal) / New (lime) / At-Risk (red) — each bar shows count + % of total
Rules:
- VIP: 10+ total visits OR $100+ lifetime spend
- Regular: 3+ visits in last 30 days
- New: first visit within last 7 days
- At-Risk: was Regular, no visit in 30+ days
AI insight: "Returning customers make up X% of your sales"

### 9.3 Feedback section
Donut chart: Positive (green) / Neutral (gray) / Negative (red)
Feeds from one-tap star ratings on order status page (new feature: show 1-5 star rating prompt on order status page after order is delivered)

### 9.4 Top products by customer (from real order data — no placeholder text)

---

## STEP 10 — AI Business Chatbot (Galeyr 1.0 exclusive)

### Interface
- Floating icon, bottom-right, every admin page, brand color
- Opens as slide-in side panel (not full-screen, same interaction weight as notification dropdown)
- Multi-turn conversation with message history
- Suggested quick questions shown as pill chips below messages
- Session-only history v1

### The absolute constraint (non-negotiable on every single turn)
The AI routes questions to existing reporting RPCs and answers **exclusively from real returned data**. This applies to follow-up questions too — a follow-up like "why did that happen?" must trigger a new real query, never be answered from conversational memory alone. If data doesn't exist to answer the question, say so plainly. Never guess. Never generate a number.

```typescript
// System prompt template for every message
const systemPrompt = `
You are Hilaac's business assistant for ${restaurantName}. 
You have access to real-time business data via the following functions:
- getKPISummary(timeframe) 
- getRevenueTrend(days)
- getTopItems(limit)
- getPeakHours()
- getPaymentSplit()

Rules:
1. Call the appropriate function before answering any data question
2. Answer ONLY from the function's returned data — never from memory or estimation  
3. If you cannot answer from available data, say so plainly
4. This restaurant's data is private — never reference other restaurants
`;
```

### Coverage grows automatically as other steps ship
No chatbot-specific rework needed — just expose each new data source via a function:
- Day 1: sales, revenue, orders, top items, peak hours (existing RPCs)
- After Step 5: menu profitability questions
- After Step 6: inventory and stock questions
- After Step 7: expense and P&L questions
- After Step 8: staff performance questions
- After Step 9: customer questions

### Gate verification (hard gate — do not ship without confirming all 4)
1. Ask "How is my business doing?" — show actual RPC calls made, confirm every number traces to real data
2. Ask a natural follow-up ("why?") — confirm it triggers a new query, not memory
3. Ask something the data can't answer — confirm AI says so instead of guessing
4. Confirm a Goronyo/Gorgor restaurant sees a "Galeyr 1.0 exclusive" message, not the chatbot

---

## STEP 11 — Manual POS ordering

Add "New order" button to `/admin/[slug]/orders` page (owner/manager/cashier/waiter roles only).

- Reuse the exact same cart/menu/add-on selection components from the customer QR flow
- Customer phone: optional field
- Table selection or takeaway, same as customer flow  
- **Staff-created orders skip the Accept checkpoint** — staff physical presence already confirms the guest is there (this is an intentional, explicit exception to the normal Accept flow)
- Shows in Orders list, Kitchen dashboard, all reports exactly like a QR order
- Attributed to the staff member who created it

---

## STEP 12 — Reports library page

Add a downloadable report library to the Reports page (separate from the live interactive view):

Cards in a 3-column grid, each with PDF + CSV download buttons:
Daily Sales / Weekly Sales / Monthly Sales / Profitability / Employees / Customers / Expenses / Waste / Suppliers / Locations / Menu

CSV export: add alongside existing Excel (.xlsx) export — same data, different format.

---

## STEP 13 — Multi-branch comparison (Gorgor 1.0+)

Add a "Locations" tab to the Reports page.

Table view: Location | Sales | Revenue | Orders | Avg Order | Top Item | Growth %
- Top-performing location gets a gold star + "Best" label (never rely on color alone)
- Pull from existing per-branch RPC calls in parallel, respecting existing RLS isolation

---

## STEP 14 — SOS currency support

In Settings → Currency: add USD / SOS toggle (using Phase 2.5 column).
SOS exchange rate configurable in Platform Settings (since it fluctuates).
Apply throughout: all price displays, KPI cards, reports, exports.

---

## STEP 15 — Platform ("Hilaac Platform") improvements

### 15.1 Subscription renewal reminder automation
Add a Vercel cron job that runs daily:
- Find restaurants with subscription_end_date within 7 days
- Send renewal reminder email via existing Resend integration
- Log sent reminders to avoid duplicate sends

### 15.2 Manual "Remind" button
Already exists on the Platform All Restaurants table — confirm it sends real email (Twilio/WhatsApp credentials still need adding to Vercel env vars for WhatsApp delivery; email via Resend works now).

### 15.3 Platform Health overview
Add 4 stat cards to Platform dashboard: Total Tenants / Active / Expiring ≤7 days / Expired
Already partially built — confirm all 4 are live with real counts.

---

## STEP 16 — Retail-readiness (schema only, no retail features yet)

The `business_type` field from Step 2.6 is the only thing needed now. Document in a code comment that when `business_type = 'retail'`:
- "Menu" nav item → "Products"
- Kitchen/Waiter dashboards hidden
- Inventory table reused (same structure)
- Cashier adapted for retail checkout

**Do not build any retail features until at least 2 Galeyr 1.0 restaurant subscribers are actively using Phase 5 features (Steps 6, 7, 8, 9).** This is a separate product line, not a feature. It shares: staff accounts, billing, payments, AI chatbot, platform admin layer.

---

## CRITICAL CONSTRAINTS — apply to every step

1. **Never break the QR ordering flow** — real customers use this daily
2. **Never touch core orders/payments/middleware** without explicit justification — fully audited
3. **Never bypass the Accept checkpoint** except for the explicitly documented staff POS exception (Step 11)
4. **Never let the AI chatbot generate a number** — every figure must trace to a real database query
5. **Never default unknown subscription tiers to restrictive** — fail open, log loudly
6. **Never change subscription_end_date during tier migration**
7. **Never ship a feature with placeholder data** — if data doesn't exist yet, show "—" or hide the section, never fake it
8. **Always confirm with me before running production database migrations**
9. **Show me the feature gate audit list (Step 1.1) before touching any subscription tier code**
10. **Show me the rollback script (Step 1.2) before any data migration**

---

## Verification pattern for every step

Before marking any step complete:
1. Place a real test order end-to-end and confirm it appears correctly everywhere (Kitchen, Waiter, Cashier, Orders page, Reports)
2. Confirm the specific step's feature works with real data (not hardcoded)
3. Confirm dark mode and light mode both look correct
4. Confirm mobile (< 768px) doesn't break layout
5. Confirm existing restaurants' subscription gates are unaffected

---

## What "done" looks like

An owner opens Hilaac, taps the chat icon, and asks in Somali or English:
*"How is my restaurant doing this week?"*

The system responds with the actual week's revenue, the top-selling item, its profit margin, a flag that one ingredient is running low, and a note that a regular customer hasn't been back in two weeks. All from real data. No guessing. No charts to interpret. Just answers.

That's the product. Build toward that.
