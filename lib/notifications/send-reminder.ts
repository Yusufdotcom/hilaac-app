import { maskPhoneForLog } from "@/lib/privacy/mask-phone";
import { maskEmailForLog } from "@/lib/privacy/mask-email";
import { getResendConfig, sendTransactionalEmail } from "@/lib/email/resend";
import { buildRenewalReminderEmail } from "@/lib/notifications/reminder-email";
import { getTwilioConfig, isWhatsAppDryRun } from "@/lib/whatsapp/config";
import { toWhatsAppAddress } from "@/lib/whatsapp/phone";
import { sendWhatsAppTemplate, sendWhatsAppText } from "@/lib/whatsapp/twilio";

export type ReminderChannel = "email" | "whatsapp";

export type PaymentReminderResult = {
  sent: boolean;
  dryRun: boolean;
  channel: ReminderChannel | "none";
  reason?: string;
  id?: string | null;
  /** @deprecated use id — kept so older logs/UI keep working */
  sid?: string | null;
};

export type RenewalReminderInput = {
  restaurantName: string;
  restaurantSlug: string;
  plan: string;
  subscriptionEndDate: string;
  daysRemaining: number;
  ownerName?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type SendPaymentReminderOpts = {
  /** Cron may dry-run. Explicit Platform "Remind" must not pretend a send succeeded. */
  allowDryRun?: boolean;
};

/**
 * Ordered reminder channels. Email is live now.
 * Add "whatsapp" here (or set REMINDER_WHATSAPP=true) once WhatsApp Business is approved.
 */
export function reminderChannelOrder(): ReminderChannel[] {
  const channels: ReminderChannel[] = ["email"];
  if (process.env.REMINDER_WHATSAPP === "true") {
    channels.push("whatsapp");
  }
  return channels;
}

function channelConfigured(channel: ReminderChannel): boolean {
  if (channel === "email") return getResendConfig().configured;
  if (channel === "whatsapp") return getTwilioConfig().configured && !isWhatsAppDryRun();
  return false;
}

/**
 * Send a subscription reminder through the first available channel.
 * Today that is email (Resend). WhatsApp stays implemented for later.
 */
export async function sendPaymentReminder(
  input: RenewalReminderInput,
  opts: SendPaymentReminderOpts = {}
): Promise<PaymentReminderResult> {
  const allowDryRun = opts.allowDryRun !== false;
  const channels = reminderChannelOrder();
  const failures: PaymentReminderResult[] = [];

  for (const channel of channels) {
    const configured = channelConfigured(channel);
    if (!configured) {
      const reason =
        channel === "email"
          ? "Email is not configured on the server (missing RESEND_API_KEY or EMAIL_FROM)"
          : "WhatsApp is not configured on the server (missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_FROM)";
      if (allowDryRun) {
        console.info("[reminder] subscription dry-run (channel unconfigured)", {
          channel,
          restaurantName: input.restaurantName,
        });
        failures.push({ sent: false, dryRun: true, channel, reason });
        continue;
      }
      failures.push({ sent: false, dryRun: false, channel: "none", reason });
      continue;
    }

    const result =
      channel === "email"
        ? await sendEmailReminder(input)
        : await sendWhatsAppReminder(input, { allowDryRun });

    if (result.sent) return result;
    failures.push(result);
  }

  return (
    failures.find((f) => !f.dryRun) ??
    failures[0] ?? {
      sent: false,
      dryRun: false,
      channel: "none",
      reason: "No reminder channel available",
    }
  );
}

async function sendEmailReminder(input: RenewalReminderInput): Promise<PaymentReminderResult> {
  const to = input.email?.trim() || "";
  if (!to || !to.includes("@")) {
    return { sent: false, dryRun: false, channel: "none", reason: "Owner has no email on file" };
  }

  const content = buildRenewalReminderEmail(input);
  const result = await sendTransactionalEmail({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!result.ok) {
    console.error("[reminder] email send failed", {
      to: maskEmailForLog(to),
      restaurantName: input.restaurantName,
      error: result.error,
    });
    return { sent: false, dryRun: false, channel: "email", reason: result.error };
  }

  console.info("[reminder] email sent", {
    to: maskEmailForLog(to),
    restaurantName: input.restaurantName,
    id: result.id,
  });
  return { sent: true, dryRun: false, channel: "email", id: result.id, sid: result.id };
}

async function sendWhatsAppReminder(
  input: RenewalReminderInput,
  opts: { allowDryRun: boolean }
): Promise<PaymentReminderResult> {
  const toWhatsApp = toWhatsAppAddress(input.phone);
  if (!toWhatsApp) {
    return { sent: false, dryRun: false, channel: "none", reason: "invalid_phone" };
  }

  const days = Math.max(0, input.daysRemaining);
  const bodyText = `Hilaac: Salaan ${input.restaurantName}, xubinimadaadu waxay dhacaysaa ${days} maalmood. Fadlan dib u cusboonaysii si aad u sii isticmaalto Hilaac.`;
  const contentSid = process.env.TWILIO_WA_CONTENT_SID_RENEWAL?.trim() || "";

  const result = contentSid
    ? await sendWhatsAppTemplate({
        toWhatsApp,
        contentSid,
        contentVariables: { "1": input.restaurantName, "2": String(days) },
        forceLive: !opts.allowDryRun,
      })
    : await sendWhatsAppText({ toWhatsApp, body: bodyText, forceLive: !opts.allowDryRun });

  if (!result.ok) {
    return { sent: false, dryRun: false, channel: "whatsapp", reason: result.error };
  }
  if (result.dryRun) {
    console.info("[reminder] subscription dry-run", {
      to: maskPhoneForLog(toWhatsApp),
      restaurantName: input.restaurantName,
      daysRemaining: days,
    });
    return {
      sent: false,
      dryRun: true,
      channel: "whatsapp",
      reason: "WhatsApp dry-run is on — message was not delivered",
      sid: null,
    };
  }

  return { sent: true, dryRun: false, channel: "whatsapp", id: result.sid, sid: result.sid };
}
