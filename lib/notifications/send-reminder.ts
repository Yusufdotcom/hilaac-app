/**
 * Sends a payment-reminder SMS/WhatsApp message. Wire this up to a real
 * provider (Twilio, WhatsApp Business API, etc.) using env vars — never log
 * message content containing phone numbers or payment details in production.
 */
export async function sendPaymentReminder(phone: string, restaurantName: string, daysRemaining: number) {
  const message = `Hilaac: Salaan ${restaurantName}, xubinimadaadu waxay dhacaysaa ${daysRemaining} maalmood. Fadlan dib u cusboonaysii si aad u sii isticmaalto Hilaac.`;

  if (!process.env.SMS_PROVIDER_API_KEY) {
    console.info(`[dev] Would send reminder to ${phone}: "${message}"`);
    return { sent: false, reason: "SMS provider not configured" };
  }

  // Example integration point:
  // await fetch(process.env.SMS_PROVIDER_URL!, {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${process.env.SMS_PROVIDER_API_KEY}` },
  //   body: JSON.stringify({ to: phone, message }),
  // });

  return { sent: true };
}
