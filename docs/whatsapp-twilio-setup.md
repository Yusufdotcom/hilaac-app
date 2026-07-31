# WhatsApp via Twilio — Setup checklist

Do this **before** expecting real deliveries. Template approval can take 1–3+ business days.

## 1. Accounts & verification

1. Create a [Twilio](https://www.twilio.com) account.
2. In Twilio Console → **Messaging → Try it out → Send a WhatsApp message** (Sandbox) for early testing, **or**
3. Register a **WhatsApp Business Sender** (production):
   - Meta Business Manager account
   - Business verification (legal name, address, website, docs Meta requests)
   - Display name for the WhatsApp sender (must match / relate to the restaurant brand)
   - Phone number Twilio will use as the WhatsApp sender

## 2. Templates to submit early (Meta approval)

Submit these in Twilio → **Content Template Builder** (or Messaging → Content Editor).  
Language: English (and Somali later if needed). Category matters for cost/rules.

### A) Order ready — **Utility**

Suggested name: `hilaac_order_ready`

Body (example — finalize wording, then submit):

> Your order {{1}} at {{2}} is ready for pickup/serving. See you soon!

Variables:
- `{{1}}` — order number (e.g. `#142`)
- `{{2}}` — restaurant name

### B) Re-engagement — **Marketing**

Suggested name: `hilaac_come_back`

Body (example):

> Hi from {{1}}! It's been a while — come back for 10% off your next order. Reply STOP to opt out.

Variables:
- `{{1}}` — restaurant name

**Important:** Marketing templates cost per send and Meta limits users to ~2 marketing msgs/day across businesses. Hilaac defaults to at most once every 21 days per customer (configurable 14–30).

## 3. Opt-out (required)

In Twilio Console for the WhatsApp sender, enable **Advanced Opt-Out** so `STOP` / similar replies automatically suppress future marketing.  
Also set the inbound webhook to:

`https://<your-production-domain>/api/webhooks/twilio/whatsapp`

(Hilaac marks the contact opted-out in our DB as a second line of defense.)

## 4. Env vars to give Hilaac (Vercel + `.env.local`)

```bash
# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+1415xxxxxxx   # your approved sender (or sandbox)

# Content SIDs from approved templates (HX…)
TWILIO_WA_CONTENT_SID_ORDER_READY=
TWILIO_WA_CONTENT_SID_REENGAGE=

# Safety — keep true until templates are approved and you've done a dry-run
WHATSAPP_DRY_RUN=true

# Optional cost estimates shown in Settings (USD per message)
TWILIO_WA_COST_UTILITY_USD=0.01
TWILIO_WA_COST_MARKETING_USD=0.05

# Existing cron auth (re-engagement job)
CRON_SECRET=
```

## 5. What to send back to the engineer

Once ready, paste:

1. `TWILIO_ACCOUNT_SID` / confirmation Auth Token is in Vercel (do **not** paste the token in chat if avoidable)
2. `TWILIO_WHATSAPP_FROM` value
3. Content SIDs for both templates + approval status (Pending / Approved)
4. Production app URL for the webhook
5. Whether you want **Sandbox** testing first or go straight to the Business sender
