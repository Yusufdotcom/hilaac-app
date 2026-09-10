import { NextRequest, NextResponse } from "next/server";
import { createOrderCore } from "@/lib/order/create-order-core";
import { mintChargeToken, mintOrderAccessToken } from "@/lib/payments/charge-token";

interface IncomingItem {
  menuItemId: string;
  quantity: number;
  addOnIds: string[];
  notes?: string;
}

/**
 * POST /api/orders
 * Creates a new order + its line items on behalf of an (anonymous) customer.
 * Totals are recomputed server-side — never trust a client-supplied total.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    restaurantId,
    tableId,
    orderType,
    items,
    notes,
    customerPhone,
    paymentMethod,
    billingModel,
    whatsappMarketingOptIn,
  } = body as {
    restaurantId: string;
    tableId: string | null;
    orderType: "dine-in" | "takeaway";
    items: IncomingItem[];
    notes?: string;
    customerPhone?: string;
    paymentMethod?: "evc" | "edahab";
    billingModel?: "pay_before" | "pay_after";
    whatsappMarketingOptIn?: boolean;
  };

  const result = await createOrderCore({
    restaurantId,
    tableId,
    orderType,
    items: items ?? [],
    notes,
    customerPhone,
    paymentMethod,
    billingModel: billingModel ?? "pay_before",
    whatsappMarketingOptIn,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  let chargeToken: string | null = null;
  let accessToken: string | null = null;
  try {
    chargeToken = mintChargeToken(result.orderId, restaurantId);
    accessToken = mintOrderAccessToken(result.orderId, restaurantId);
  } catch (err) {
    console.warn("[orders] order tokens not minted", {
      reason: err instanceof Error ? err.message : "unknown",
    });
  }

  return NextResponse.json({
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    total: result.total,
    chargeToken,
    accessToken,
  });
}
