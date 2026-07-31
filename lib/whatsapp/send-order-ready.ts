import type { SupabaseClient } from "@supabase/supabase-js";
import { estimatedCostUsd, getTwilioConfig } from "@/lib/whatsapp/config";
import { normalizeWhatsAppPhone, toWhatsAppAddress } from "@/lib/whatsapp/phone";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/twilio";
import { formatOrderLabel } from "@/lib/utils";

/**
 * Non-throwing: notify customer that their order is ready.
 * Safe to call fire-and-forget after kitchen marks Ready.
 */
export async function sendOrderReadyWhatsApp(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  try {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, status, restaurant_id, customer_phone")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return { sent: false, skipped: "order_not_found" };
    }

    if (order.status !== "ready") {
      return { sent: false, skipped: "not_ready" };
    }

    const phone = normalizeWhatsAppPhone(order.customer_phone);
    const to = toWhatsAppAddress(order.customer_phone);
    if (!phone || !to) {
      return { sent: false, skipped: "invalid_phone" };
    }

    const [{ data: settings }, { data: restaurant }] = await Promise.all([
      supabase
        .from("whatsapp_settings")
        .select("order_ready_enabled")
        .eq("restaurant_id", order.restaurant_id)
        .maybeSingle(),
      supabase.from("restaurants").select("name").eq("id", order.restaurant_id).maybeSingle(),
    ]);

    if (!settings?.order_ready_enabled) {
      return { sent: false, skipped: "disabled" };
    }

    // Idempotency: already sent/dry-run for this order?
    const { data: existing } = await supabase
      .from("whatsapp_message_log")
      .select("id, status")
      .eq("order_id", orderId)
      .eq("message_type", "order_ready")
      .in("status", ["dry_run", "queued", "sent"])
      .maybeSingle();

    if (existing) {
      return { sent: false, skipped: "already_sent" };
    }

    const cfg = getTwilioConfig();
    const orderLabel = formatOrderLabel(
      { id: order.id, order_number: order.order_number },
      { prefix: false }
    );
    const restaurantName = restaurant?.name ?? "the restaurant";

    const result = await sendWhatsAppTemplate({
      toWhatsApp: to,
      contentSid: cfg.orderReadyContentSid,
      contentVariables: {
        "1": orderLabel,
        "2": restaurantName,
      },
    });

    const cost = estimatedCostUsd("order_ready");
    const status = !result.ok ? "failed" : result.dryRun ? "dry_run" : "sent";

    await supabase.from("whatsapp_message_log").insert({
      restaurant_id: order.restaurant_id,
      phone_normalized: phone,
      message_type: "order_ready",
      order_id: order.id,
      status,
      provider_sid: result.ok && !result.dryRun ? result.sid : null,
      error_message: result.ok ? null : result.error,
      estimated_cost_usd: status === "failed" ? null : cost,
    });

    // Keep contact last_order_at fresh for re-engagement eligibility.
    await supabase.from("whatsapp_contacts").upsert(
      {
        restaurant_id: order.restaurant_id,
        phone_normalized: phone,
        last_order_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id,phone_normalized" }
    );

    if (!result.ok) {
      return { sent: false, error: result.error };
    }
    return { sent: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "order_ready_failed";
    console.error("[whatsapp] sendOrderReadyWhatsApp", { orderId, error });
    return { sent: false, error };
  }
}
