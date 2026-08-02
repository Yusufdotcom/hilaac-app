/**
 * H6: demonstrate masked phone logging (no plaintext phones).
 */
import { maskPhoneForLog } from "../lib/privacy/mask-phone.ts";
import { sendPaymentReminder } from "../lib/notifications/send-reminder.ts";
import { sendWhatsAppTemplate } from "../lib/whatsapp/twilio.ts";

const full = "+252618184696";
const wa = "whatsapp:+252618184696";

console.log("maskPhoneForLog(+252618184696) =>", maskPhoneForLog(full));
console.log("maskPhoneForLog(whatsapp:+252618184696) =>", maskPhoneForLog(wa));

delete process.env.SMS_PROVIDER_API_KEY;
process.env.WHATSAPP_DRY_RUN = "true";

console.log("--- live log lines from call sites ---");
await sendPaymentReminder(full, "Demo Restaurant", 3);
await sendWhatsAppTemplate({
  toWhatsApp: wa,
  contentSid: "",
  contentVariables: { "1": "Demo" },
});

const expected = "+252******4696";
const expectedWa = "whatsapp:+252******4696";
let failed = 0;
if (maskPhoneForLog(full) !== expected) {
  console.log("FAIL  mask format", maskPhoneForLog(full));
  failed += 1;
} else {
  console.log("PASS  mask format", expected);
}
if (maskPhoneForLog(wa) !== expectedWa) {
  console.log("FAIL  whatsapp mask format", maskPhoneForLog(wa));
  failed += 1;
} else {
  console.log("PASS  whatsapp mask format", expectedWa);
}

process.exit(failed > 0 ? 1 : 0);
