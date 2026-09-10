import { generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HILAAC_AI_MODEL } from "@/lib/ai/model";
import { normalizeLoyaltyPhone } from "@/lib/loyalty/phone";
import type { OrderStatus } from "@/types/database";

const MAX_WORDS = 30;

function wordCap(text: string, max = MAX_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return words.slice(0, max).join(" ");
}

type StatusContext = {
  status: OrderStatus;
  waiterName: string | null;
  kitchenName: string | null;
  topItem: string | null;
  tableNumber: string | null;
  loyalty: { current: number; target: number; reward: string } | null;
};

async function loadStatusContext(
  supabase: SupabaseClient,
  orderId: string
): Promise<StatusContext | null> {
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, status, restaurant_id, table_id, delivered_by, accepted_by, customer_phone, order_items(quantity, menu_item:menu_items(name))"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    console.error("[status-message] load order", error?.message);
    return null;
  }

  const items = (order.order_items ?? []) as {
    quantity: number;
    menu_item?: { name?: string } | null;
  }[];
  const topItem =
    [...items]
      .map((i) => ({
        name: i.menu_item?.name || "item",
        quantity: Number(i.quantity) || 0,
      }))
      .sort((a, b) => b.quantity - a.quantity)[0]?.name ?? null;

  let tableNumber: string | null = null;
  if (order.table_id) {
    const { data: table } = await supabase
      .from("restaurant_tables")
      .select("table_number")
      .eq("id", order.table_id)
      .maybeSingle();
    tableNumber = table?.table_number ? String(table.table_number) : null;
  }

  let kitchenName: string | null = null;
  if (order.accepted_by) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", order.accepted_by)
      .maybeSingle();
    kitchenName = staff?.full_name?.trim() || null;
  }

  let loyalty: StatusContext["loyalty"] = null;
  const phoneNorm = normalizeLoyaltyPhone(order.customer_phone);
  if (phoneNorm) {
    const [{ data: settings }, { data: progress }] = await Promise.all([
      supabase
        .from("loyalty_settings")
        .select("enabled, target_order_count, reward_description")
        .eq("restaurant_id", order.restaurant_id)
        .maybeSingle(),
      supabase
        .from("loyalty_progress")
        .select("current_count")
        .eq("restaurant_id", order.restaurant_id)
        .eq("phone_normalized", phoneNorm)
        .maybeSingle(),
    ]);
    if (settings?.enabled) {
      loyalty = {
        current: Number(progress?.current_count ?? 0) || 0,
        target: Number(settings.target_order_count) || 0,
        reward: String(settings.reward_description || "reward"),
      };
    }
  }

  return {
    status: order.status as OrderStatus,
    waiterName: order.delivered_by ? String(order.delivered_by) : null,
    kitchenName,
    topItem,
    tableNumber,
    loyalty,
  };
}

function fallbackMessage(ctx: StatusContext): string {
  const item = ctx.topItem || "order";
  if (ctx.status === "preparing" || ctx.status === "new") {
    const who = ctx.kitchenName || "The kitchen";
    return `${who} is starting on your ${item} now.`;
  }
  if (ctx.status === "ready") {
    const table = ctx.tableNumber ? ` Table ${ctx.tableNumber}` : "";
    return `Your ${item} is ready! Someone will bring it to you${table ? ` at${table}` : ""} shortly.`;
  }
  if (ctx.status === "delivered" || ctx.status === "completed") {
    if (ctx.loyalty && ctx.loyalty.target > 0) {
      return `Enjoy your meal! Loyalty progress: ${ctx.loyalty.current}/${ctx.loyalty.target} toward your free ${ctx.loyalty.reward}.`;
    }
    return "Enjoy your meal!";
  }
  return "We are taking care of your order.";
}

/**
 * Generate ≤30-word contextual status_message and store on the order.
 * Fail soft — never throws; returns null if generation+fallback both skip.
 */
export async function generateAndStoreOrderStatusMessage(
  supabase: SupabaseClient,
  orderId: string
): Promise<string | null> {
  const ctx = await loadStatusContext(supabase, orderId);
  if (!ctx) return null;

  const interesting: OrderStatus[] = ["new", "preparing", "ready", "delivered", "completed"];
  if (!interesting.includes(ctx.status)) return null;

  let message = fallbackMessage(ctx);

  try {
    const result = await generateText({
      model: HILAAC_AI_MODEL,
      system: `Write a short customer-facing order status update for a Somali restaurant.
Use ONLY the facts provided. Never invent names, items, tables, or loyalty numbers.
Cap at ${MAX_WORDS} words. Warm and clear. No emojis.`,
      prompt: JSON.stringify({
        guidance:
          ctx.status === "ready"
            ? "Preparing → Ready style"
            : ctx.status === "delivered" || ctx.status === "completed"
              ? "Ready → Delivered style with loyalty if present"
              : "New → Preparing style",
        facts: ctx,
      }),
    });
    const generated = wordCap(result.text?.trim() || "");
    if (generated) message = generated;
  } catch (err) {
    console.error("[status-message] openai", err);
  }

  message = wordCap(message);
  if (!message) return null;

  const { error } = await supabase
    .from("orders")
    .update({ status_message: message })
    .eq("id", orderId);

  if (error) {
    console.error("[status-message] update", error.message);
    return null;
  }

  return message;
}
