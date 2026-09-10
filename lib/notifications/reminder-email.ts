import { TIER_PLANS, normalizeTier, tierDisplayName } from "@/lib/billing/tier-capabilities";
import { buildAppUrl } from "@/lib/app-url";

export type RenewalEmailInput = {
  restaurantName: string;
  restaurantSlug: string;
  plan: string;
  subscriptionEndDate: string;
  daysRemaining: number;
  ownerName?: string | null;
};

function planLabel(tier: string) {
  const known = normalizeTier(tier);
  if (!known) return tier;
  if (known === "trial") return "Trial";
  const plan = TIER_PLANS[known];
  return `${tierDisplayName(known)} (${plan.priceLabel})`;
}

function formatExpiryDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(iso));
}

export function renewalReminderSubject(input: RenewalEmailInput): string {
  const days = Math.max(0, input.daysRemaining);
  if (input.daysRemaining <= 0) {
    return `Your Hilaac subscription for ${input.restaurantName} has expired`;
  }
  return `Your Hilaac subscription for ${input.restaurantName} expires in ${days} day${days === 1 ? "" : "s"}`;
}

export function buildRenewalReminderEmail(input: RenewalEmailInput): {
  subject: string;
  html: string;
  text: string;
  billingUrl: string;
} {
  const subject = renewalReminderSubject(input);
  const billingUrl = buildAppUrl(`/admin/${input.restaurantSlug}/billing?renew=1`);
  const plan = planLabel(input.plan);
  const expiry = formatExpiryDate(input.subscriptionEndDate);
  const days = input.daysRemaining;
  const greeting = input.ownerName?.trim() ? `Hi ${input.ownerName.trim()},` : "Hi,";
  const timing =
    days <= 0
      ? `has expired as of ${expiry}`
      : `expires in ${days} day${days === 1 ? "" : "s"} (${expiry})`;

  const text = [
    greeting,
    "",
    `This is a recap of the Hilaac subscription for ${input.restaurantName}.`,
    "",
    `Restaurant: ${input.restaurantName}`,
    `Current plan: ${plan}`,
    `Status: ${timing}`,
    "",
    "To renew, open Billing in your Hilaac admin, pay with EVC Plus or eDahab using the USSD codes shown there, then submit your transaction reference so we can confirm payment and extend the subscription.",
    "",
    `Renew here: ${billingUrl}`,
    "",
    "If you already paid, you can ignore this email — we'll confirm as soon as the reference is submitted.",
    "",
    "— The Hilaac team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <tr>
            <td style="background:#0F172A;padding:20px 28px;">
              <p style="margin:0;color:#D4A373;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Hilaac</p>
              <p style="margin:6px 0 0;color:#ffffff;font-size:18px;font-weight:700;">Subscription recap</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;color:#0F172A;font-size:15px;line-height:1.5;">${escapeHtml(greeting)}</p>
              <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.6;">
                This is a recap of the Hilaac subscription for <strong>${escapeHtml(input.restaurantName)}</strong>.
                It ${escapeHtml(timing)}.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Restaurant</p>
                    <p style="margin:0 0 14px;color:#0F172A;font-size:15px;font-weight:600;">${escapeHtml(input.restaurantName)}</p>
                    <p style="margin:0 0 8px;color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Current plan</p>
                    <p style="margin:0 0 14px;color:#0F172A;font-size:15px;font-weight:600;">${escapeHtml(plan)}</p>
                    <p style="margin:0 0 8px;color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Expiry</p>
                    <p style="margin:0;color:#0F172A;font-size:15px;font-weight:600;">${escapeHtml(expiry)}${days > 0 ? ` · ${days} day${days === 1 ? "" : "s"} left` : " · expired"}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.6;">
                Renew from Billing in your Hilaac admin. Pay with <strong>EVC Plus</strong> or <strong>eDahab</strong> using the USSD codes shown on that page, then submit your transaction reference so we can confirm payment and extend the subscription.
              </p>
              <p style="margin:0 0 24px;">
                <a href="${escapeHtml(billingUrl)}"
                   style="display:inline-block;background:#D4A373;color:#0F172A;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                  Open Billing to renew
                </a>
              </p>
              <p style="margin:0;color:#64748B;font-size:13px;line-height:1.5;">
                If you already paid, you can ignore this email — we'll confirm as soon as the reference is submitted.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;color:#94A3B8;font-size:12px;">— The Hilaac team</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text, billingUrl };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
