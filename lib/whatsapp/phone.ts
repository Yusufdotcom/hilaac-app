import { normalizeLoyaltyPhone } from "@/lib/loyalty/phone";

/** E.164 digits → Twilio WhatsApp address `whatsapp:+252…` */
export function toWhatsAppAddress(phone: string | null | undefined): string | null {
  const normalized = normalizeLoyaltyPhone(phone);
  if (!normalized) return null;
  return `whatsapp:+${normalized}`;
}

export { normalizeLoyaltyPhone as normalizeWhatsAppPhone };
