export interface ChargeParams {
  merchantId: string;
  apiKey: string;
  amount: number;
  phone: string | null;
  reference: string;
}

export interface ChargeResult {
  success: boolean;
  status: "paid" | "pending" | "failed";
  providerReference?: string;
  error?: string;
}

/**
 * Thin adapters around the EVC Plus and eDahab merchant APIs. Both providers
 * are called with decrypted credentials that only ever live in memory for
 * the duration of this request — they are never logged or persisted.
 */
async function callProvider(baseUrl: string | undefined, params: ChargeParams): Promise<ChargeResult> {
  if (!baseUrl) {
    return { success: false, status: "failed", error: "Payment gateway is not configured on the server." };
  }

  try {
    const res = await fetch(`${baseUrl}/charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.apiKey}` },
      body: JSON.stringify({
        merchantId: params.merchantId,
        amount: params.amount,
        phone: params.phone,
        reference: params.reference,
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { success: false, status: "failed", error: data?.error ?? "Payment gateway rejected the charge." };
    }

    return {
      success: true,
      status: data.status === "paid" ? "paid" : "pending",
      providerReference: data.reference ?? data.transactionId,
    };
  } catch (err: any) {
    return { success: false, status: "failed", error: "Could not reach the payment gateway." };
  }
}

export function chargeEvc(params: ChargeParams) {
  return callProvider(process.env.EVC_API_BASE_URL, params);
}

export function chargeEdahab(params: ChargeParams) {
  return callProvider(process.env.EDAHAB_API_BASE_URL, params);
}
