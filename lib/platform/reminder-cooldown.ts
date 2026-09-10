export const REMINDER_COOLDOWN_MS = 60 * 60 * 1000;

export type ReminderCooldown = {
  minutesAgo: number;
  remainingMs: number;
  lastSentAt: string;
  label: string;
};

export function alreadyRemindedLabel(minutesAgo: number): string {
  if (minutesAgo < 1) return "Already reminded just now";
  if (minutesAgo === 1) return "Already reminded 1 minute ago";
  return `Already reminded ${minutesAgo} minutes ago`;
}

export function reminderCooldown(
  sentAt: string | Date | null | undefined,
  now = Date.now()
): ReminderCooldown | null {
  if (!sentAt) return null;
  const at = typeof sentAt === "string" ? sentAt : sentAt.toISOString();
  const elapsed = now - new Date(sentAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= REMINDER_COOLDOWN_MS) {
    return null;
  }
  const minutesAgo = Math.floor(elapsed / 60_000);
  return {
    minutesAgo,
    remainingMs: REMINDER_COOLDOWN_MS - elapsed,
    lastSentAt: at,
    label: alreadyRemindedLabel(minutesAgo),
  };
}
