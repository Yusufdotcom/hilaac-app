export const PLANS = {
  starter: {
    name: "Starter",
    price: 29,
    priceLabel: "$29/mo",
    description: "USSD payments, QR ordering, kitchen dashboard.",
    features: [
      "QR code ordering",
      "Unlimited menu items",
      "Real-time kitchen dashboard",
      "USSD mobile money (EVC/eDahab)",
      "Up to 3 staff accounts",
    ],
  },
  pro: {
    name: "Pro",
    price: 79,
    priceLabel: "$79/mo",
    description: "Everything in Starter, plus API payments and AI tools.",
    features: [
      "Everything in Starter",
      "Direct API mobile money payments",
      "AI menu image generator",
      "Unlimited staff accounts",
      "Priority support",
    ],
  },
} as const;

export const TRIAL_DAYS = 7;

export function canUseAiFeatures(tier: string | null | undefined) {
  return tier === "pro" || tier === "trial";
}

export function canUseApiPayments(tier: string | null | undefined) {
  return tier === "pro" || tier === "trial";
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  waiter: "Waiter",
  kitchen: "Kitchen Staff",
  cashier: "Cashier",
};
