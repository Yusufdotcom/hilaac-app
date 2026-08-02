/**
 * Redact a phone (or WhatsApp address) for logs.
 * Example: +252618184696 → +252******4696
 *          whatsapp:+252618184696 → whatsapp:+252******4696
 */
export function maskPhoneForLog(phone: string | null | undefined): string {
  if (phone == null) return "***";
  const raw = String(phone).trim();
  if (!raw) return "***";

  const whatsappPrefix = raw.match(/^whatsapp:/i)?.[0] ?? "";
  const rest = whatsappPrefix ? raw.slice(whatsappPrefix.length) : raw;

  const hasPlus = rest.startsWith("+");
  const digits = rest.replace(/\D/g, "");
  if (digits.length < 6) {
    return `${whatsappPrefix}***`;
  }

  const country = digits.slice(0, 3);
  const last4 = digits.slice(-4);
  return `${whatsappPrefix}${hasPlus ? "+" : ""}${country}******${last4}`;
}
