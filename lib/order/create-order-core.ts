import { createAdminClient } from "@/lib/supabase/server";
import { normalizeLoyaltyPhone } from "@/lib/loyalty/phone";
import { paymentStatusAwaitingCashierWrite } from "@/lib/payments/constants";

export type CreateOrderLineInput = {
  menuItemId: string;
  quantity: number;
  addOnIds: string[];
  notes?: string;
};

export type CreateOrderCoreInput = {
  restaurantId: string;
  tableId: string | null;
  orderType: "dine-in" | "takeaway";
  items: CreateOrderLineInput[];
  notes?: string | null;
  customerPhone?: string | null;
  paymentMethod?: "evc" | "edahab" | null;
  billingModel: "pay_before" | "pay_after";
  whatsappMarketingOptIn?: boolean;
  /** When set, order is staff POS: auto-accepted and kitchen-visible as `new`. */
  staffPos?: {
    createdBy: string;
    acceptedBy: string;
  };
};

export type CreateOrderCoreResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: number | null;
      total: number;
    }
  | { ok: false; status: number; error: string };

/**
 * Shared order write path used by guest QR (`/api/orders`) and staff POS.
 * Always recomputes totals from menu/add-on prices — never trusts client totals.
 */
export async function createOrderCore(
  input: CreateOrderCoreInput
): Promise<CreateOrderCoreResult> {
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
    staffPos,
  } = input;
  const marketingOptIn = Boolean(whatsappMarketingOptIn);

  if (!restaurantId || !orderType || !Array.isArray(items) || items.length === 0) {
    return { ok: false, status: 400, error: "Missing required order fields" };
  }

  const supabase = createAdminClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, is_active")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant || !restaurant.is_active) {
    return { ok: false, status: 404, error: "Restaurant not found or inactive" };
  }

  const menuItemIds = items.map((i) => i.menuItemId);
  const addOnIds = Array.from(new Set(items.flatMap((i) => i.addOnIds ?? [])));

  const [{ data: menuItems }, { data: addOns }] = await Promise.all([
    supabase.from("menu_items").select("id, price, restaurant_id, is_available").in("id", menuItemIds),
    addOnIds.length > 0
      ? supabase.from("add_ons").select("id, name, price, restaurant_id").in("id", addOnIds)
      : Promise.resolve({ data: [] as { id: string; name: string; price: number; restaurant_id: string }[] }),
  ]);

  const menuItemMap = new Map((menuItems ?? []).map((m) => [m.id, m]));
  const addOnMap = new Map((addOns ?? []).map((a) => [a.id, a]));

  let total = 0;
  const orderItemsPayload: {
    menu_item_id: string;
    quantity: number;
    add_ons: { id: string; name: string; price: number }[];
    notes: string | null;
    price_at_time: number;
  }[] = [];

  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId);
    if (!menuItem || menuItem.restaurant_id !== restaurantId || !menuItem.is_available) {
      return { ok: false, status: 400, error: "One or more items are no longer available" };
    }
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const selectedAddOns = (item.addOnIds ?? [])
      .map((id) => addOnMap.get(id))
      .filter((a): a is NonNullable<typeof a> => !!a && a.restaurant_id === restaurantId);

    const unitPrice = Number(menuItem.price) + selectedAddOns.reduce((sum, a) => sum + Number(a.price), 0);
    total += unitPrice * quantity;

    orderItemsPayload.push({
      menu_item_id: menuItem.id,
      quantity,
      add_ons: selectedAddOns.map((a) => ({ id: a.id, name: a.name, price: Number(a.price) })),
      notes: item.notes || null,
      price_at_time: Number(menuItem.price),
    });
  }

  // Staff POS: guest is present — skip Accept and send straight to kitchen as `new`.
  // Guest QR: pay_before → awaiting_payment; pay_after → new (still needs Accept).
  const initialStatus = staffPos
    ? "new"
    : billingModel === "pay_before"
      ? "awaiting_payment"
      : "new";
  const initialPaymentStatus = paymentStatusAwaitingCashierWrite();
  const nowIso = new Date().toISOString();

  const { data: latestOrder } = await supabase
    .from("orders")
    .select("order_number")
    .eq("restaurant_id", restaurantId)
    .not("order_number", "is", null)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrderNumber =
    typeof latestOrder?.order_number === "number" ? latestOrder.order_number + 1 : 100;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      restaurant_id: restaurantId,
      table_id: orderType === "dine-in" ? tableId : null,
      order_type: orderType,
      status: initialStatus,
      payment_status: initialPaymentStatus,
      billing_model: billingModel,
      payment_method: paymentMethod ?? null,
      order_number: nextOrderNumber,
      total,
      customer_phone: customerPhone || null,
      whatsapp_marketing_opt_in: marketingOptIn,
      notes: notes || null,
      ...(staffPos
        ? {
            accepted_at: nowIso,
            accepted_by: staffPos.acceptedBy,
            created_by: staffPos.createdBy,
          }
        : {}),
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    return { ok: false, status: 500, error: orderError?.message ?? "Could not create order" };
  }

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItemsPayload.map((i) => ({ ...i, order_id: order.id })));

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return { ok: false, status: 500, error: itemsError.message };
  }

  const phoneNormalized = normalizeLoyaltyPhone(customerPhone);
  if (phoneNormalized) {
    const { data: existing } = await supabase
      .from("whatsapp_contacts")
      .select("marketing_opt_in, opted_out_at")
      .eq("restaurant_id", restaurantId)
      .eq("phone_normalized", phoneNormalized)
      .maybeSingle();

    const optedOut = Boolean(existing?.opted_out_at);
    await supabase.from("whatsapp_contacts").upsert(
      {
        restaurant_id: restaurantId,
        phone_normalized: phoneNormalized,
        marketing_opt_in: optedOut ? false : marketingOptIn || Boolean(existing?.marketing_opt_in),
        last_order_at: nowIso,
        updated_at: nowIso,
        ...(marketingOptIn && !optedOut ? { opted_out_at: null } : {}),
      },
      { onConflict: "restaurant_id,phone_normalized" }
    );
  }

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.order_number,
    total,
  };
}
