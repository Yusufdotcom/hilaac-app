import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

interface IncomingItem {
  menuItemId: string;
  quantity: number;
  addOnIds: string[];
  notes?: string;
}

/**
 * POST /api/orders
 * Creates a new order + its line items on behalf of an (anonymous) customer.
 * Runs server-side with the service role so we can recompute the total from
 * the authoritative menu_items/add_ons prices — never trusting a
 * client-supplied total — before ever writing to the database.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { restaurantId, tableId, orderType, items, notes, customerPhone, paymentMethod } = body as {
    restaurantId: string;
    tableId: string | null;
    orderType: "dine-in" | "takeaway";
    items: IncomingItem[];
    notes?: string;
    customerPhone?: string;
    paymentMethod: "evc" | "edahab";
  };

  if (!restaurantId || !orderType || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Missing required order fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, is_active")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant || !restaurant.is_active) {
    return NextResponse.json({ error: "Restaurant not found or inactive" }, { status: 404 });
  }

  const menuItemIds = items.map((i) => i.menuItemId);
  const addOnIds = Array.from(new Set(items.flatMap((i) => i.addOnIds ?? [])));

  const [{ data: menuItems }, { data: addOns }] = await Promise.all([
    supabase.from("menu_items").select("id, price, restaurant_id, is_available").in("id", menuItemIds),
    addOnIds.length > 0
      ? supabase.from("add_ons").select("id, name, price, restaurant_id").in("id", addOnIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const menuItemMap = new Map((menuItems ?? []).map((m) => [m.id, m]));
  const addOnMap = new Map((addOns ?? []).map((a) => [a.id, a]));

  let total = 0;
  const orderItemsPayload: any[] = [];

  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId);
    if (!menuItem || menuItem.restaurant_id !== restaurantId || !menuItem.is_available) {
      return NextResponse.json({ error: "One or more items are no longer available" }, { status: 400 });
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

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      restaurant_id: restaurantId,
      table_id: orderType === "dine-in" ? tableId : null,
      order_type: orderType,
      status: "new",
      payment_status: "pending",
      payment_method: paymentMethod ?? null,
      total,
      customer_phone: customerPhone || null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Could not create order" }, { status: 500 });
  }

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItemsPayload.map((i) => ({ ...i, order_id: order.id })));

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ orderId: order.id, total });
}
