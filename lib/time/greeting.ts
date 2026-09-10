import { APP_TIMEZONE, getZonedYmd } from "@/lib/time/app-calendar";

/** Time-of-day greeting using APP_TIMEZONE wall clock (not server UTC). */
export function getTimeOfDayGreeting(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** e.g. "Today, Thursday, September 10, 2026" using APP_TIMEZONE. */
export function formatTodayLabel(now: Date = new Date()): string {
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);
  return `Today, ${datePart}`;
}

/** First name for greeting; falls back to "there". */
export function greetingDisplayName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}

/** Expose zoned YMD for tests / callers that need the calendar day. */
export function greetingZonedYmd(now: Date = new Date()) {
  return getZonedYmd(now);
}
