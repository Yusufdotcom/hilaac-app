import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canUseWhatsAppReengagement,
  estimatedCostUsd,
  getTwilioConfig,
} from "@/lib/whatsapp/config";
import { toWhatsAppAddress } from "@/lib/whatsapp/phone";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/twilio";

export type ReengagementCandidate = {
  restaurant_id: string;
  restaurant_name: string;
  phone_normalized: string;
  last_order_at: string | null;
  idle_days: number;
};

/**
 * Find contacts eligible for a marketing re-engagement message.
 * Does not send — used by dry-run and live cron.
 */
export async function findReengagementCandidates(
  supabase: SupabaseClient,
  now = new Date()
): Promise<ReengagementCandidate[]> {
  const { data: settingsRows, error } = await supabase
    .from("whatsapp_settings")
    .select(
      "restaurant_id, reengagement_enabled, reengagement_idle_days, reengagement_min_interval_days"
    )
    .eq("reengagement_enabled", true);

  if (error) {
    console.error("[whatsapp] findReengagementCandidates settings", error.message);
    return [];
  }

  const candidates: ReengagementCandidate[] = [];

  for (const row of settingsRows ?? []) {
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, name, subscription_tier, subscription_status, is_active")
      .eq("id", row.restaurant_id)
      .maybeSingle();

    if (!restaurant?.is_active) continue;
    if (restaurant.subscription_status === "expired") continue;
    if (!canUseWhatsAppReengagement(restaurant.subscription_tier)) continue;

    const idleDays = Number(row.reengagement_idle_days) || 14;
    const minInterval = Number(row.reengagement_min_interval_days) || 21;
    const idleCutoff = new Date(now.getTime() - idleDays * 24 * 60 * 60 * 1000).toISOString();
    const intervalCutoff = new Date(
      now.getTime() - minInterval * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: contacts, error: contactError } = await supabase
      .from("whatsapp_contacts")
      .select("phone_normalized, last_order_at, last_reengagement_sent_at")
      .eq("restaurant_id", row.restaurant_id)
      .eq("marketing_opt_in", true)
      .is("opted_out_at", null)
      .not("last_order_at", "is", null)
      .lt("last_order_at", idleCutoff)
      .limit(200);

    if (contactError) {
      console.error("[whatsapp] contacts query", {
        restaurantId: row.restaurant_id,
        error: contactError.message,
      });
      continue;
    }

    for (const c of contacts ?? []) {
      if (!c.last_order_at) continue;
      if (
        c.last_reengagement_sent_at &&
        c.last_reengagement_sent_at >= intervalCutoff
      ) {
        continue;
      }
      const idleMs = now.getTime() - new Date(c.last_order_at).getTime();
      candidates.push({
        restaurant_id: row.restaurant_id,
        restaurant_name: restaurant.name,
        phone_normalized: c.phone_normalized,
        last_order_at: c.last_order_at,
        idle_days: Math.floor(idleMs / (24 * 60 * 60 * 1000)),
      });
    }
  }

  return candidates;
}

export async function sendReengagementMessage(
  supabase: SupabaseClient,
  candidate: ReengagementCandidate
): Promise<{ sent: boolean; dryRun?: boolean; error?: string; skipped?: string }> {
  const to = toWhatsAppAddress(candidate.phone_normalized);
  if (!to) return { sent: false, skipped: "invalid_phone" };

  // Re-check opt-out / interval right before send.
  const { data: contact } = await supabase
    .from("whatsapp_contacts")
    .select("marketing_opt_in, opted_out_at, last_reengagement_sent_at")
    .eq("restaurant_id", candidate.restaurant_id)
    .eq("phone_normalized", candidate.phone_normalized)
    .maybeSingle();

  if (!contact?.marketing_opt_in || contact.opted_out_at) {
    return { sent: false, skipped: "opted_out" };
  }

  const cfg = getTwilioConfig();
  const result = await sendWhatsAppTemplate({
    toWhatsApp: to,
    contentSid: cfg.reengageContentSid,
    contentVariables: { "1": candidate.restaurant_name },
  });

  const cost = estimatedCostUsd("reengagement");
  const status = !result.ok ? "failed" : result.dryRun ? "dry_run" : "sent";

  await supabase.from("whatsapp_message_log").insert({
    restaurant_id: candidate.restaurant_id,
    phone_normalized: candidate.phone_normalized,
    message_type: "reengagement",
    order_id: null,
    status,
    provider_sid: result.ok && !result.dryRun ? result.sid : null,
    error_message: result.ok ? null : result.error,
    estimated_cost_usd: status === "failed" ? null : cost,
  });

  if (result.ok) {
    await supabase
      .from("whatsapp_contacts")
      .update({
        last_reengagement_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("restaurant_id", candidate.restaurant_id)
      .eq("phone_normalized", candidate.phone_normalized);
  }

  if (!result.ok) return { sent: false, error: result.error };
  return { sent: true, dryRun: result.dryRun };
}
