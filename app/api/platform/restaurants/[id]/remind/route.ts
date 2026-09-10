import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPaymentReminder } from "@/lib/notifications/send-reminder";
import { resolveOwnerContact } from "@/lib/platform/resolve-owner-contact";
import { reminderCooldown } from "@/lib/platform/reminder-cooldown";
import { daysUntil } from "@/lib/utils";

function jsonError(error: string, status: number, code?: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { success: false, error, ...(code ? { code } : {}), ...extra },
    { status }
  );
}

/**
 * POST /api/platform/restaurants/[id]/remind
 * Manual subscription reminder from Platform console (email now; WhatsApp later).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return auth.response;

    const restaurantId = params.id?.trim();
    if (!restaurantId) {
      return jsonError("Restaurant id required", 400);
    }

    const admin = createAdminClient();
    const { data: restaurant, error } = await admin
      .from("restaurants")
      .select(
        "id, name, slug, owner_id, subscription_end_date, subscription_status, subscription_tier, last_subscription_reminder_at"
      )
      .eq("id", restaurantId)
      .maybeSingle();

    if (error || !restaurant) {
      return jsonError("Restaurant not found", 404);
    }

    if (!restaurant.owner_id) {
      return jsonError("Restaurant has no owner", 400, "no_owner");
    }

    const cooldown = reminderCooldown(restaurant.last_subscription_reminder_at);
    if (cooldown) {
      return jsonError(cooldown.label, 429, "reminder_cooldown", {
        lastSentAt: cooldown.lastSentAt,
        minutesAgo: cooldown.minutesAgo,
      });
    }

    const contact = await resolveOwnerContact(admin, {
      ownerId: restaurant.owner_id,
      restaurantId: restaurant.id,
    });

    if (!contact.email) {
      return jsonError("Owner has no email on file", 400, "no_owner_email");
    }

    const days = daysUntil(restaurant.subscription_end_date);
    const result = await sendPaymentReminder(
      {
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        plan: restaurant.subscription_tier,
        subscriptionEndDate: restaurant.subscription_end_date,
        daysRemaining: days,
        ownerName: contact.ownerName,
        email: contact.email,
        phone: contact.phone,
      },
      { allowDryRun: false }
    );

    console.info("[platform] manual_renewal_reminder", {
      by: auth.user.id,
      restaurantId: restaurant.id,
      slug: restaurant.slug,
      days,
      sent: result.sent,
      dryRun: result.dryRun,
      channel: result.channel,
      reason: result.reason,
      emailSource: contact.emailSource,
    });

    if (!result.sent) {
      return jsonError(
        result.reason ?? "Reminder was not delivered",
        result.dryRun ? 503 : 502,
        result.dryRun ? "reminder_not_delivered" : "reminder_send_failed"
      );
    }

    const sentAt = new Date().toISOString();
    await admin
      .from("restaurants")
      .update({ last_subscription_reminder_at: sentAt })
      .eq("id", restaurant.id);

    return NextResponse.json({
      success: true,
      restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
      daysRemaining: days,
      reminder: result,
      lastSentAt: sentAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("[platform] remind_failed", msg);
    return jsonError(msg, 500);
  }
}
