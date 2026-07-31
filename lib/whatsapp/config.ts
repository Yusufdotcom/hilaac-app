export function isWhatsAppDryRun(): boolean {
  const raw = process.env.WHATSAPP_DRY_RUN;
  if (raw == null || raw === "") return true; // safe default
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}

export function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim() || "";
  const orderReadyContentSid = process.env.TWILIO_WA_CONTENT_SID_ORDER_READY?.trim() || "";
  const reengageContentSid = process.env.TWILIO_WA_CONTENT_SID_REENGAGE?.trim() || "";

  return {
    accountSid,
    authToken,
    from,
    orderReadyContentSid,
    reengageContentSid,
    configured: Boolean(accountSid && authToken && from),
  };
}

export function estimatedCostUsd(messageType: "order_ready" | "reengagement"): number {
  if (messageType === "order_ready") {
    return Number(process.env.TWILIO_WA_COST_UTILITY_USD ?? 0.01) || 0.01;
  }
  return Number(process.env.TWILIO_WA_COST_MARKETING_USD ?? 0.05) || 0.05;
}

export function canUseWhatsAppReengagement(tier: string | null | undefined) {
  return tier === "pro" || tier === "trial";
}
